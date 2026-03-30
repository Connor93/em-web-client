import {
  Direction,
  ItemGetClientPacket,
  ItemSubtype,
  ItemType,
  MapTileSpec,
  NpcType,
  SitState,
  SkillTargetType,
  SkillType,
} from 'eolib';

import type { Client } from '../client';
import { ATTACK_TICKS } from '../consts';
import { getTimestamp } from '../movement-controller';
import {
  CharacterAttackAnimation,
  CharacterDeathAnimation,
  CharacterRangedAttackAnimation,
  CharacterWalkAnimation,
  NpcDeathAnimation,
} from '../render';
import { playSfxById } from '../sfx';
import { AutoBattleState, SfxId, SpellTarget } from '../types';
import type { Vector2 } from '../vector';
import { autoBattleSettings } from './auto-battle-settings';
import { findPathTo, isWarpTile } from './map-manager';

/** Ranged weapon attack range in tiles. */
const RANGED_ATTACK_RANGE = 4;

/** How many ticks between heal actions. */
const HEAL_COOLDOWN_TICKS = 10;

/** How many consecutive pathfinding failures before skipping a target. */
const MAX_PATH_FAILURES = 3;

/** How many ticks to wait before re-scanning for targets when idle. */
const RESCAN_INTERVAL_TICKS = 5;

/** Game ticks per minute (tick rate = ~8.33 ticks/sec at 120ms per tick). */
const TICKS_PER_MINUTE = 500;

/** Visible range for spells (roughly half-screen in tiles). */
const SPELL_VISIBLE_RANGE = 11;

/** Max breadcrumb kill-locations to remember. */
const MAX_BREADCRUMBS = 10;

/** How many ticks to wait at a breadcrumb before moving to the next. */
const BREADCRUMB_LINGER_TICKS = 15;

/** How many consecutive breadcrumbs with no enemy found before random explore. */
const EMPTY_CRUMBS_BEFORE_EXPLORE = 2;

// ── Internal State ───────────────────────────────────────────────────────

let pathFailureCount = 0;
let failedTargetIndex = 0;
let rescanCooldown = 0;
let healCooldown = 0;
let startExperience = 0;

/** Ring buffer of recent kill locations (newest at end). */
let killBreadcrumbs: { x: number; y: number }[] = [];

/** Current index into killBreadcrumbs we're roaming toward. */
let breadcrumbIndex = 0;

/** Ticks remaining to linger at a breadcrumb before trying the next. */
let breadcrumbLingerTicks = 0;

/** How many breadcrumbs we've visited without finding a target. */
let emptyBreadcrumbCount = 0;

// ── Public API ───────────────────────────────────────────────────────────

export function startAutoBattle(client: Client): void {
  if (client.autoBattleState !== AutoBattleState.IDLE) return;

  const settings = autoBattleSettings.getAll();
  client.autoBattleState = AutoBattleState.FIND_TARGET;
  client.autoBattleTargetIndex = 0;
  client.autoBattleKillCount = 0;
  client.autoBattleStartTime = Date.now();
  client.autoBattleAttackCooldown = 0;
  client.autoBattleLootCoords = null;
  startExperience = client.experience;
  pathFailureCount = 0;
  failedTargetIndex = 0;
  rescanCooldown = 0;
  healCooldown = 0;
  killBreadcrumbs = [];
  breadcrumbIndex = 0;
  breadcrumbLingerTicks = 0;
  emptyBreadcrumbCount = 0;

  if (settings.timerMinutes > 0) {
    client.autoBattleTimerTicks = settings.timerMinutes * TICKS_PER_MINUTE;
  } else {
    client.autoBattleTimerTicks = 0; // 0 = indefinite
  }

  client.emit('autoBattleStarted', undefined);
}

export function stopAutoBattle(client: Client, reason = 'Manual'): void {
  if (client.autoBattleState === AutoBattleState.IDLE) return;

  const elapsed = Date.now() - client.autoBattleStartTime;
  const expGained = client.experience - startExperience;

  client.emit('autoBattleStopped', {
    reason,
    kills: client.autoBattleKillCount,
    expGained,
    elapsed,
  });

  client.autoBattleState = AutoBattleState.IDLE;
  client.autoBattleTargetIndex = 0;
  client.autoBattleTimerTicks = 0;
  client.autoBattleAttackCooldown = 0;
  client.autoBattleLootCoords = null;
  client.autoWalkPath = [];
  pathFailureCount = 0;
  failedTargetIndex = 0;
  killBreadcrumbs = [];
  breadcrumbIndex = 0;
  breadcrumbLingerTicks = 0;

  // Play notification sound
  playSfxById(SfxId.ServerMessage);
}

export function isAutoBattleActive(client: Client): boolean {
  return client.autoBattleState !== AutoBattleState.IDLE;
}

/** Auto-battle is only available when the URL contains ?autobattle=true */
let _unlocked: boolean | null = null;
export function isAutoBattleUnlocked(): boolean {
  if (_unlocked === null) {
    const params = new URLSearchParams(window.location.search);
    _unlocked = params.get('autobattle') === 'true';
  }
  return _unlocked;
}

export function toggleAutoBattle(client: Client): void {
  if (!isAutoBattleUnlocked()) return;
  if (isAutoBattleActive(client)) {
    stopAutoBattle(client);
  } else {
    startAutoBattle(client);
  }
}

// ── Tick Entry Point ─────────────────────────────────────────────────────

export function tickAutoBattle(client: Client): void {
  if (client.autoBattleState === AutoBattleState.IDLE) return;

  // ── Global checks ──
  // Timer
  if (client.autoBattleTimerTicks > 0) {
    client.autoBattleTimerTicks--;
    if (client.autoBattleTimerTicks <= 0) {
      stopAutoBattle(client, 'Timer expired');
      return;
    }
  }

  // Player dead
  const playerAnim = client.characterAnimations.get(client.playerId);
  if (playerAnim instanceof CharacterDeathAnimation) {
    stopAutoBattle(client, 'Player died');
    return;
  }

  // Overweight — can't attack
  if (client.weight.current >= client.weight.max) {
    stopAutoBattle(client, 'Overweight');
    return;
  }

  // Player sitting — stand first
  const character = client.getPlayerCharacter();
  if (!character) return;
  if (
    character.sitState === SitState.Floor ||
    character.sitState === SitState.Chair
  ) {
    client.stand();
    return;
  }

  // Cooldowns
  if (client.autoBattleAttackCooldown > 0) {
    client.autoBattleAttackCooldown--;
  }
  if (healCooldown > 0) {
    healCooldown--;
  }

  // ── Emergency heal check (any state) ──
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const settings = autoBattleSettings.getAll();

  if (hpPercent <= settings.emergencyHpThreshold) {
    if (tryEmergencyHeal(client)) return;
    // If no healing resources at emergency threshold, flee
    if (hpPercent <= 5) {
      stopAutoBattle(client, 'Emergency: No healing resources');
      return;
    }
  }

  // ── Auto-loot check (any state) ──
  if (settings.autoPickupItems) {
    tryAutoLoot(client);
  }

  // ── Periodic stats update ──
  if (client.tickCount % 25 === 0) {
    const elapsed = Date.now() - client.autoBattleStartTime;
    client.emit('autoBattleStatsUpdate', {
      kills: client.autoBattleKillCount,
      expGained: client.experience - startExperience,
      elapsed,
      status: getStatusText(client.autoBattleState),
    });
  }

  // ── State machine ──
  switch (client.autoBattleState) {
    case AutoBattleState.FIND_TARGET:
      tickFindTarget(client);
      break;
    case AutoBattleState.MOVE_TO_TARGET:
      tickMoveToTarget(client);
      break;
    case AutoBattleState.ATTACK:
      tickAttack(client);
      break;
    case AutoBattleState.HEAL:
      tickHeal(client);
      break;
    case AutoBattleState.ROAM_TO_BREADCRUMB:
      tickRoamToBreadcrumb(client);
      break;
    case AutoBattleState.RANDOM_EXPLORE:
      tickRandomExplore(client);
      break;
  }
}

// ── State: FIND_TARGET ───────────────────────────────────────────────────

function tickFindTarget(client: Client): void {
  // Check if healing needed first
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 100;
  const settings = autoBattleSettings.getAll();

  if (
    hpPercent <= settings.healHpThreshold ||
    tpPercent <= settings.healTpThreshold
  ) {
    client.autoBattleState = AutoBattleState.HEAL;
    return;
  }

  // Throttle re-scans
  if (rescanCooldown > 0) {
    rescanCooldown--;
    return;
  }

  const target = findBestTarget(client);
  if (!target) {
    // No targets visible — try roaming to a breadcrumb
    if (killBreadcrumbs.length > 0) {
      client.autoBattleState = AutoBattleState.ROAM_TO_BREADCRUMB;
      breadcrumbLingerTicks = 0;
      return;
    }
    // No breadcrumbs either — just wait
    rescanCooldown = RESCAN_INTERVAL_TICKS;
    return;
  }

  client.autoBattleTargetIndex = target.index;
  pathFailureCount = 0;
  failedTargetIndex = 0;

  if (isInAttackRange(client, target.coords)) {
    client.autoBattleState = AutoBattleState.ATTACK;
  } else {
    client.autoBattleState = AutoBattleState.MOVE_TO_TARGET;
  }
}

// ── State: MOVE_TO_TARGET ────────────────────────────────────────────────

function tickMoveToTarget(client: Client): void {
  const npc = client.getNpcByIndex(client.autoBattleTargetIndex);
  if (!npc) {
    // Target gone
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    client.autoWalkPath = [];
    return;
  }

  // Check if NPC is dying
  const npcAnim = client.npcAnimations.get(npc.index);
  if (npcAnim instanceof NpcDeathAnimation) {
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    client.autoWalkPath = [];
    return;
  }

  if (isInAttackRange(client, npc.coords)) {
    client.autoBattleState = AutoBattleState.ATTACK;
    client.autoWalkPath = [];
    return;
  }

  // Only set a new path when we're not already walking
  const animation = client.characterAnimations.get(client.playerId);
  if (animation instanceof CharacterWalkAnimation) {
    // Even while walking, check if a closer NPC has appeared
    const better = findBestTarget(client);
    if (better && better.index !== client.autoBattleTargetIndex) {
      // New/closer target found — interrupt walk and switch to it
      client.autoBattleTargetIndex = better.index;
      client.autoWalkPath = [];
      pathFailureCount = 0;
      failedTargetIndex = 0;
    }
    return;
  }

  if (client.autoWalkPath.length === 0) {
    // Find path to a tile adjacent to or within range of the NPC
    const targetTile = findTileInRange(client, npc.coords, 0);
    if (!targetTile) {
      pathFailureCount++;
      if (
        pathFailureCount >= MAX_PATH_FAILURES &&
        failedTargetIndex === client.autoBattleTargetIndex
      ) {
        // Skip this target
        client.autoBattleTargetIndex = 0;
        client.autoBattleState = AutoBattleState.FIND_TARGET;
        pathFailureCount = 0;
      } else {
        failedTargetIndex = client.autoBattleTargetIndex;
      }
      return;
    }

    const path = findPathTo(client, targetTile, true);
    if (path.length === 0) {
      pathFailureCount++;
      if (
        pathFailureCount >= MAX_PATH_FAILURES &&
        failedTargetIndex === client.autoBattleTargetIndex
      ) {
        client.autoBattleTargetIndex = 0;
        client.autoBattleState = AutoBattleState.FIND_TARGET;
        pathFailureCount = 0;
      } else {
        failedTargetIndex = client.autoBattleTargetIndex;
      }
      return;
    }

    client.autoWalkPath = path;
    pathFailureCount = 0;
  }
}

// ── State: ATTACK ────────────────────────────────────────────────────────

function tickAttack(client: Client): void {
  const npc = client.getNpcByIndex(client.autoBattleTargetIndex);
  if (!npc) {
    // NPC disappeared (killed by us or someone else) — record last known pos
    recordKillBreadcrumb(
      client.autoBattleLootCoords ?? client.getPlayerCoords(),
    );
    client.autoBattleKillCount++;
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    return;
  }

  // Check if NPC is dying
  const npcAnim = client.npcAnimations.get(npc.index);
  if (npcAnim instanceof NpcDeathAnimation) {
    recordKillBreadcrumb(npc.coords);
    client.autoBattleKillCount++;
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    return;
  }

  // Check if heal needed
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const settings = autoBattleSettings.getAll();
  if (hpPercent <= settings.healHpThreshold) {
    client.autoBattleState = AutoBattleState.HEAL;
    return;
  }

  // Out of range — go back to movement
  if (!isInAttackRange(client, npc.coords)) {
    client.autoBattleState = AutoBattleState.MOVE_TO_TARGET;
    return;
  }

  // Can't attack while animating
  const playerAnim = client.characterAnimations.get(client.playerId);
  if (playerAnim?.ticks) return;

  // Cooldown not ready
  if (client.autoBattleAttackCooldown > 0) return;

  // Face the NPC
  const direction = getDirectionTowards(client, npc.coords);

  // Decide: spell or physical attack
  if (settings.useAttackSpells && canCastAttackSpell(client, npc.index)) {
    castAttackSpell(client, npc.index, settings.attackSpellId);
    client.autoBattleAttackCooldown = ATTACK_TICKS;
  } else if (isInPhysicalRange(client, npc.coords)) {
    // Physical attack
    const character = client.getPlayerCharacter();

    // Must face the NPC before attacking. The server needs time to process
    // the direction change. Match the normal movement controller's delay:
    // ATTACK_TICKS - 3 ticks (same as movement-controller.ts face → attack gap).
    if (character && character.direction !== direction) {
      character.direction = direction;
      client.face(direction);
      client.autoBattleAttackCooldown = ATTACK_TICKS - 3;
      return;
    }

    client.characterAnimations.set(
      client.playerId,
      isRanged(client)
        ? new CharacterRangedAttackAnimation()
        : new CharacterAttackAnimation(),
    );
    client.attack(direction, getTimestamp());
    client.autoBattleAttackCooldown = ATTACK_TICKS;
  }
}

// ── State: HEAL ──────────────────────────────────────────────────────────

function tickHeal(client: Client): void {
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 100;
  const settings = autoBattleSettings.getAll();

  // Check if healed enough
  if (
    hpPercent > settings.healHpThreshold &&
    tpPercent > settings.healTpThreshold
  ) {
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    return;
  }

  if (healCooldown > 0) return;

  // HP healing
  if (hpPercent <= settings.healHpThreshold) {
    const isEmergency = hpPercent <= settings.emergencyHpThreshold;

    // Try heal spell (if not emergency, or emergency but still try spell first if HP > 5%)
    if (settings.useHealSpell && !isEmergency && tryHealSpell(client)) {
      healCooldown = HEAL_COOLDOWN_TICKS;
      return;
    }

    // Use HP potion
    if (tryUseHpPotion(client)) {
      healCooldown = HEAL_COOLDOWN_TICKS;
      return;
    }

    // Last resort: try heal spell even if not enabled (emergency)
    if (isEmergency && tryHealSpell(client)) {
      healCooldown = HEAL_COOLDOWN_TICKS;
      return;
    }

    // No HP healing resources available — stop
    if (isEmergency) {
      stopAutoBattle(client, 'No HP potions or heal spells');
      return;
    }
  }

  // TP recovery
  if (tpPercent <= settings.healTpThreshold) {
    if (tryUseTpPotion(client)) {
      healCooldown = HEAL_COOLDOWN_TICKS;
      return;
    }

    // No TP potions available
    if (settings.useAttackSpells || settings.useHealSpell) {
      // Spells enabled but no TP — stop
      stopAutoBattle(client, 'No TP potions');
      return;
    }
  }

  // No healing resources but not in emergency — go back to fighting
  client.autoBattleState = AutoBattleState.FIND_TARGET;
}

// ── State: ROAM_TO_BREADCRUMB ────────────────────────────────────────────

function tickRoamToBreadcrumb(client: Client): void {
  // Re-check for NPCs on every tick while roaming — if we spot one, grab it
  const target = findBestTarget(client);
  if (target) {
    client.autoBattleTargetIndex = target.index;
    pathFailureCount = 0;
    failedTargetIndex = 0;
    emptyBreadcrumbCount = 0;
    client.autoWalkPath = [];

    client.autoBattleState = isInAttackRange(client, target.coords)
      ? AutoBattleState.ATTACK
      : AutoBattleState.MOVE_TO_TARGET;
    return;
  }

  // Check healing while roaming
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 100;
  const settings = autoBattleSettings.getAll();
  if (
    hpPercent <= settings.healHpThreshold ||
    tpPercent <= settings.healTpThreshold
  ) {
    client.autoBattleState = AutoBattleState.HEAL;
    client.autoWalkPath = [];
    return;
  }

  // No breadcrumbs left — go back to idle scanning
  if (killBreadcrumbs.length === 0) {
    client.autoBattleState = AutoBattleState.FIND_TARGET;
    rescanCooldown = RESCAN_INTERVAL_TICKS;
    return;
  }

  // Clamp index
  if (breadcrumbIndex >= killBreadcrumbs.length) {
    breadcrumbIndex = 0;
  }

  const crumb = killBreadcrumbs[breadcrumbIndex];
  const player = client.getPlayerCoords();
  const distToCrumb =
    Math.abs(player.x - crumb.x) + Math.abs(player.y - crumb.y);

  // Arrived at breadcrumb (or close enough)
  if (distToCrumb <= 1) {
    // Linger briefly to let server send any nearby NPCs
    if (breadcrumbLingerTicks < BREADCRUMB_LINGER_TICKS) {
      breadcrumbLingerTicks++;
      return;
    }

    // Move to next breadcrumb
    breadcrumbLingerTicks = 0;
    emptyBreadcrumbCount++;
    breadcrumbIndex = (breadcrumbIndex + 1) % killBreadcrumbs.length;

    // If we've visited enough empty breadcrumbs, switch to random explore
    if (emptyBreadcrumbCount >= EMPTY_CRUMBS_BEFORE_EXPLORE) {
      client.autoBattleState = AutoBattleState.RANDOM_EXPLORE;
      client.autoWalkPath = [];
      emptyBreadcrumbCount = 0;
      return;
    }

    // If we've cycled through all breadcrumbs without finding anything,
    // go back to FIND_TARGET and wait for spawns
    if (breadcrumbIndex === 0) {
      client.autoBattleState = AutoBattleState.FIND_TARGET;
      rescanCooldown = RESCAN_INTERVAL_TICKS;
    }
    return;
  }

  // Walk toward the breadcrumb
  const animation = client.characterAnimations.get(client.playerId);
  if (animation instanceof CharacterWalkAnimation) {
    return; // Already walking
  }

  if (client.autoWalkPath.length === 0) {
    const path = findPathTo(client, crumb, true);
    if (path.length === 0) {
      // Can't path to this breadcrumb — skip it
      breadcrumbLingerTicks = 0;
      breadcrumbIndex = (breadcrumbIndex + 1) % killBreadcrumbs.length;
      if (breadcrumbIndex === 0) {
        client.autoBattleState = AutoBattleState.FIND_TARGET;
        rescanCooldown = RESCAN_INTERVAL_TICKS;
      }
      return;
    }
    client.autoWalkPath = path;
  }
}

// ── State: RANDOM_EXPLORE ────────────────────────────────────────────────

function tickRandomExplore(client: Client): void {
  // Check for NPCs every tick
  const target = findBestTarget(client);
  if (target) {
    client.autoBattleTargetIndex = target.index;
    pathFailureCount = 0;
    failedTargetIndex = 0;
    client.autoWalkPath = [];
    emptyBreadcrumbCount = 0;
    client.autoBattleState = isInAttackRange(client, target.coords)
      ? AutoBattleState.ATTACK
      : AutoBattleState.MOVE_TO_TARGET;
    return;
  }

  // Check healing
  const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 100;
  const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 100;
  const settings = autoBattleSettings.getAll();
  if (
    hpPercent <= settings.healHpThreshold ||
    tpPercent <= settings.healTpThreshold
  ) {
    client.autoBattleState = AutoBattleState.HEAL;
    client.autoWalkPath = [];
    return;
  }

  const animation = client.characterAnimations.get(client.playerId);
  if (animation instanceof CharacterWalkAnimation) {
    return;
  }

  if (client.autoWalkPath.length === 0) {
    // Pick a random walkable, non-warp tile within a reasonable radius
    const playerCoords = client.getPlayerCoords();
    const EXPLORE_RADIUS = 12;
    const attempts = 20;

    for (let i = 0; i < attempts; i++) {
      const dx =
        Math.floor(Math.random() * (EXPLORE_RADIUS * 2 + 1)) - EXPLORE_RADIUS;
      const dy =
        Math.floor(Math.random() * (EXPLORE_RADIUS * 2 + 1)) - EXPLORE_RADIUS;
      const candidate = {
        x: playerCoords.x + dx,
        y: playerCoords.y + dy,
      };

      // Must be walkable and not a warp
      if (!client.canWalk(candidate, true)) continue;
      if (isWarpTile(client, candidate)) continue;

      // Must be far enough to be worth walking to
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 4) continue;

      const path = findPathTo(client, candidate, true);
      if (path.length > 0) {
        client.autoWalkPath = path;
        break;
      }
    }

    // If all attempts failed, go back to breadcrumbs or find target
    if (client.autoWalkPath.length === 0) {
      client.autoBattleState =
        killBreadcrumbs.length > 0
          ? AutoBattleState.ROAM_TO_BREADCRUMB
          : AutoBattleState.FIND_TARGET;
      rescanCooldown = RESCAN_INTERVAL_TICKS;
    }
  }
}

// ── Breadcrumb Helpers ───────────────────────────────────────────────────

/**
 * Records a kill location as a breadcrumb. Deduplicates nearby locations
 * (within 2 tiles) and keeps at most MAX_BREADCRUMBS entries.
 */
function recordKillBreadcrumb(coords: { x: number; y: number }): void {
  // Don't add duplicate if already close to an existing breadcrumb
  const isDuplicate = killBreadcrumbs.some(
    (bc) => Math.abs(bc.x - coords.x) + Math.abs(bc.y - coords.y) <= 2,
  );
  if (isDuplicate) return;

  killBreadcrumbs.push({ x: coords.x, y: coords.y });

  // Trim oldest if over limit
  while (killBreadcrumbs.length > MAX_BREADCRUMBS) {
    killBreadcrumbs.shift();
  }
}

/**
 * Returns a human-readable status string for the current auto-battle state.
 */
function getStatusText(state: AutoBattleState): string {
  switch (state) {
    case AutoBattleState.FIND_TARGET:
      return 'Searching...';
    case AutoBattleState.MOVE_TO_TARGET:
      return 'Approaching...';
    case AutoBattleState.ATTACK:
      return 'Battling!';
    case AutoBattleState.HEAL:
      return 'Healing...';
    case AutoBattleState.ROAM_TO_BREADCRUMB:
      return 'Roaming...';
    case AutoBattleState.RANDOM_EXPLORE:
      return 'Exploring...';
    default:
      return 'Idle';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getDistance(client: Client, coords: { x: number; y: number }): number {
  const player = client.getPlayerCoords();
  return Math.abs(player.x - coords.x) + Math.abs(player.y - coords.y);
}

/**
 * Check if a target is in the player's physical (non-spell) attack range.
 * Melee: adjacent tile (manhattan distance 1).
 * Ranged: same row OR same column, within RANGED_ATTACK_RANGE tiles.
 */
function isInPhysicalRange(
  client: Client,
  target: { x: number; y: number },
): boolean {
  const player = client.getPlayerCoords();
  const dx = Math.abs(player.x - target.x);
  const dy = Math.abs(player.y - target.y);

  if (!isRanged(client)) {
    // Melee: adjacent cardinal tile only
    return dx + dy <= 1;
  }

  // Ranged: must be on same row (dy === 0) or same column (dx === 0)
  if (dx !== 0 && dy !== 0) return false;
  if (dx + dy > RANGED_ATTACK_RANGE) return false;

  // Must have clear line of sight (no walls between player and target)
  return hasLineOfSight(client, player, target);
}

/**
 * Check if a target is in overall attack range (physical or spell).
 * Used by state machine to decide ATTACK vs MOVE_TO_TARGET.
 */
function isInAttackRange(
  client: Client,
  target: { x: number; y: number },
): boolean {
  const settings = autoBattleSettings.getAll();

  // If using attack spells, spell range uses manhattan distance + line of sight
  if (settings.useAttackSpells) {
    const dist = getDistance(client, target);
    if (dist > SPELL_VISIBLE_RANGE) return false;
    return hasLineOfSight(client, client.getPlayerCoords(), target);
  }

  return isInPhysicalRange(client, target);
}

/**
 * Check if there is a clear line of sight between two points.
 * Walks tile-by-tile along the axis connecting them and rejects
 * if any intermediate tile is a wall or edge.
 */
function hasLineOfSight(
  client: Client,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  // Walk from the tile after `from` up to (but not including) `to`
  for (let i = 1; i < steps; i++) {
    const x = from.x + stepX * i;
    const y = from.y + stepY * i;

    const spec = client.map.tileSpecRows
      .find((r) => r.y === y)
      ?.tiles.find((t) => t.x === x);

    if (
      spec &&
      (spec.tileSpec === MapTileSpec.Wall || spec.tileSpec === MapTileSpec.Edge)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Check if at least one tile exists from which the player could attack
 * the target. For ranged: any walkable tile on the same row/column within
 * RANGED_ATTACK_RANGE that has line-of-sight. For spells: any walkable
 * tile within SPELL_VISIBLE_RANGE with line-of-sight.
 */
function hasAnyAttackPosition(
  client: Client,
  target: { x: number; y: number },
): boolean {
  for (let d = 1; d <= RANGED_ATTACK_RANGE; d++) {
    const tiles = [
      { x: target.x + d, y: target.y },
      { x: target.x - d, y: target.y },
      { x: target.x, y: target.y + d },
      { x: target.x, y: target.y - d },
    ];
    for (const tile of tiles) {
      if (hasLineOfSight(client, tile, target)) {
        return true;
      }
    }
  }
  return false;
}

function isRanged(client: Client): boolean {
  // Use client.equipment.weapon (the actual item EIF ID) rather than
  // character.equipment.weapon (the visual graphic ID) because glamor
  // gems can override the visual weapon without changing the real one.
  const weaponId = client.equipment.weapon;
  if (!weaponId) return false;

  const record = client.getEifRecordById(weaponId);
  if (!record) return false;

  return record.subtype === ItemSubtype.Ranged;
}

function findBestTarget(
  client: Client,
): { index: number; coords: { x: number; y: number } } | null {
  const settings = autoBattleSettings.getAll();
  const playerCoords = client.getPlayerCoords();

  const candidates = client.nearby.npcs.filter((npc) => {
    const record = client.getEnfRecordById(npc.id);
    if (!record) return false;
    if (record.type !== NpcType.Aggressive && record.type !== NpcType.Passive) {
      return false;
    }
    if (settings.npcBlacklist.includes(npc.id)) return false;

    // Skip dying NPCs
    const anim = client.npcAnimations.get(npc.index);
    if (anim instanceof NpcDeathAnimation) return false;

    // Skip the target we just failed to path to
    if (
      pathFailureCount >= MAX_PATH_FAILURES &&
      npc.index === failedTargetIndex
    ) {
      return false;
    }

    // Skip NPCs we can't actually reach — behind walls with no pathable
    // attack position. For ranged / spells, check line-of-sight from all
    // candidate tiles; for melee, verify at least one adjacent tile exists
    // with a valid path.
    if (isRanged(client) || settings.useAttackSpells) {
      // For ranged/spell: ensure at least one cardinal tile within range
      // has line of sight to the NPC
      const hasReachableTile = hasAnyAttackPosition(client, npc.coords);
      if (!hasReachableTile) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  if (settings.targetPriority === 'weakest') {
    // Sort by ENF HP (spec1 for NPCs is often HP, but we'll use the ENF
    // record's HP field). Fallback to distance.
    candidates.sort((a, b) => {
      const recA = client.getEnfRecordById(a.id);
      const recB = client.getEnfRecordById(b.id);
      const hpA = recA?.hp ?? 9999;
      const hpB = recB?.hp ?? 9999;
      if (hpA !== hpB) return hpA - hpB;
      const distA =
        Math.abs(playerCoords.x - a.coords.x) +
        Math.abs(playerCoords.y - a.coords.y);
      const distB =
        Math.abs(playerCoords.x - b.coords.x) +
        Math.abs(playerCoords.y - b.coords.y);
      return distA - distB;
    });
  } else {
    // closest
    candidates.sort((a, b) => {
      const distA =
        Math.abs(playerCoords.x - a.coords.x) +
        Math.abs(playerCoords.y - a.coords.y);
      const distB =
        Math.abs(playerCoords.x - b.coords.x) +
        Math.abs(playerCoords.y - b.coords.y);
      return distA - distB;
    });
  }

  return { index: candidates[0].index, coords: candidates[0].coords };
}

function findTileInRange(
  client: Client,
  target: { x: number; y: number },
  _range: number,
): Vector2 | null {
  const playerCoords = client.getPlayerCoords();

  if (!isRanged(client) || autoBattleSettings.getAll().useAttackSpells) {
    // Melee or spell: find an adjacent walkable tile
    const adjacent = [
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 },
    ];

    // Sort by distance to player
    adjacent.sort(
      (a, b) =>
        Math.abs(a.x - playerCoords.x) +
        Math.abs(a.y - playerCoords.y) -
        (Math.abs(b.x - playerCoords.x) + Math.abs(b.y - playerCoords.y)),
    );

    for (const tile of adjacent) {
      if (client.canWalk(tile, true) && !isWarpTile(client, tile)) {
        return tile;
      }
    }
    return null;
  }

  // Ranged: must path to a tile on the same row or column as the NPC,
  // within RANGED_ATTACK_RANGE tiles.
  // If we're already in range, stay put.
  if (isInPhysicalRange(client, target)) {
    return playerCoords;
  }

  // Generate candidate tiles along all 4 cardinal lines from the NPC
  const candidates: { x: number; y: number; dist: number }[] = [];
  for (let d = 1; d <= RANGED_ATTACK_RANGE; d++) {
    const tiles = [
      { x: target.x + d, y: target.y },
      { x: target.x - d, y: target.y },
      { x: target.x, y: target.y + d },
      { x: target.x, y: target.y - d },
    ];
    for (const tile of tiles) {
      if (
        client.canWalk(tile, true) &&
        !isWarpTile(client, tile) &&
        hasLineOfSight(client, tile, target)
      ) {
        const dist =
          Math.abs(tile.x - playerCoords.x) + Math.abs(tile.y - playerCoords.y);
        candidates.push({ ...tile, dist });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the closest candidate to the player
  candidates.sort((a, b) => a.dist - b.dist);
  return { x: candidates[0].x, y: candidates[0].y };
}

function getDirectionTowards(
  client: Client,
  target: { x: number; y: number },
): Direction {
  const player = client.getPlayerCoords();
  const dx = target.x - player.x;
  const dy = target.y - player.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.Right : Direction.Left;
  }
  return dy > 0 ? Direction.Down : Direction.Up;
}

// ── Spell Helpers ────────────────────────────────────────────────────────

function canCastAttackSpell(client: Client, _npcIndex: number): boolean {
  if (client.spellCooldownTicks > 0) return false;
  if (client.queuedSpellId > 0) return false;

  const spellId = findAttackSpellId(client);
  if (!spellId) return false;

  const record = client.getEsfRecordById(spellId);
  if (!record) return false;
  if (client.tp < record.tpCost) return false;

  return true;
}

function findAttackSpellId(client: Client): number {
  const settings = autoBattleSettings.getAll();

  if (settings.attackSpellId > 0) {
    const spell = client.spells.find((s) => s.id === settings.attackSpellId);
    if (spell) return spell.id;
  }

  // Auto-select: find strongest attack spell by TP cost (proxy for damage)
  let best: { id: number; tpCost: number } | null = null;
  for (const spell of client.spells) {
    const record = client.getEsfRecordById(spell.id);
    if (!record) continue;
    if (record.type !== SkillType.Attack) continue;
    if (
      record.targetType !== SkillTargetType.Normal &&
      record.targetType !== SkillTargetType.Self
    ) {
      continue;
    }
    if (record.tpCost > client.tp) continue;
    if (!best || record.tpCost > best.tpCost) {
      best = { id: spell.id, tpCost: record.tpCost };
    }
  }

  return best?.id ?? 0;
}

function castAttackSpell(
  client: Client,
  npcIndex: number,
  preferredSpellId: number,
): void {
  const spellId =
    preferredSpellId > 0
      ? client.spells.find((s) => s.id === preferredSpellId)
        ? preferredSpellId
        : findAttackSpellId(client)
      : findAttackSpellId(client);

  if (!spellId) return;

  client.spellTarget = SpellTarget.Npc;
  client.spellTargetId = npcIndex;
  client.queuedSpellId = spellId;
  client.spellCooldownTicks = 999;
}

function tryHealSpell(client: Client): boolean {
  const settings = autoBattleSettings.getAll();
  let healSpellId = settings.healSpellId;

  if (healSpellId > 0) {
    const spell = client.spells.find((s) => s.id === healSpellId);
    if (!spell) healSpellId = 0;
  }

  if (!healSpellId) {
    // Auto-find heal spell
    for (const spell of client.spells) {
      const record = client.getEsfRecordById(spell.id);
      if (!record) continue;
      if (record.type !== SkillType.Heal) continue;
      if (record.targetType !== SkillTargetType.Self) continue;
      if (record.tpCost > client.tp) continue;
      healSpellId = spell.id;
      break;
    }
  }

  if (!healSpellId) return false;

  const record = client.getEsfRecordById(healSpellId);
  if (!record || client.tp < record.tpCost) return false;
  if (client.spellCooldownTicks > 0) return false;
  if (client.queuedSpellId > 0) return false;

  const playerAnim = client.characterAnimations.get(client.playerId);
  if (playerAnim) return false;

  client.spellTarget = SpellTarget.Self;
  client.spellTargetId = 0;
  client.queuedSpellId = healSpellId;
  return true;
}

// ── Potion Helpers ───────────────────────────────────────────────────────

function tryUseHpPotion(client: Client): boolean {
  // Find best HP potion in inventory (highest heal amount = spec1 for Heal items)
  let bestPotion: { id: number; healAmount: number } | null = null;

  for (const item of client.items) {
    const record = client.getEifRecordById(item.id);
    if (!record) continue;
    if (record.type !== ItemType.Heal) continue;
    // spec1 = HP heal, spec2 = TP heal for Heal items
    if (record.spec1 <= 0) continue;
    if (!bestPotion || record.spec1 > bestPotion.healAmount) {
      bestPotion = { id: item.id, healAmount: record.spec1 };
    }
  }

  if (!bestPotion) return false;
  client.useItem(bestPotion.id);
  return true;
}

function tryUseTpPotion(client: Client): boolean {
  let bestPotion: { id: number; healAmount: number } | null = null;

  for (const item of client.items) {
    const record = client.getEifRecordById(item.id);
    if (!record) continue;
    if (record.type !== ItemType.Heal) continue;
    // spec2 = TP heal for Heal items
    if (record.spec2 <= 0) continue;
    if (!bestPotion || record.spec2 > bestPotion.healAmount) {
      bestPotion = { id: item.id, healAmount: record.spec2 };
    }
  }

  if (!bestPotion) return false;
  client.useItem(bestPotion.id);
  return true;
}

function tryEmergencyHeal(client: Client): boolean {
  if (healCooldown > 0) return false;

  // Always try potions first in emergency
  if (tryUseHpPotion(client)) {
    healCooldown = HEAL_COOLDOWN_TICKS;
    return true;
  }

  // Then try heal spell
  if (tryHealSpell(client)) {
    healCooldown = HEAL_COOLDOWN_TICKS;
    return true;
  }

  return false;
}

// ── Auto-Loot ────────────────────────────────────────────────────────────

function tryAutoLoot(client: Client): void {
  // Don't pick up items if already at max weight
  if (client.weight.current >= client.weight.max) return;

  const playerCoords = client.getPlayerCoords();

  for (const item of client.nearby.items) {
    // Check if item is at player's location or adjacent
    const dist =
      Math.abs(playerCoords.x - item.coords.x) +
      Math.abs(playerCoords.y - item.coords.y);

    if (dist > 1) continue;

    // Check protection
    const protection = client.itemProtectionTimers.get(item.uid);
    if (
      protection &&
      protection.ticks > 0 &&
      protection.ownerId !== client.playerId
    ) {
      continue;
    }

    // Pick it up
    const packet = new ItemGetClientPacket();
    packet.itemIndex = item.uid;
    client.bus.send(packet);
  }
}
