import {
  Coords,
  ItemGetClientPacket,
  MapTileSpec,
  SitState,
  SkillType,
} from 'eolib';
import type { Client } from '../client';
import {
  getBoardIntersecting,
  getCharacterIntersecting,
  getDoorIntersecting,
  getLockerIntersecting,
  getNpcIntersecting,
  getSignIntersecting,
} from '../collision';
import { EOResourceID } from '../edf';
import { CursorClickAnimation } from '../render';
import { GameState } from '../types';
import { showGameToast } from '../ui/game-toast/game-toast';
import { capitalize } from '../utils';

let lastProtectedToastAt = 0;

export function handleClick(client: Client, e: MouseEvent): void {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('game');
  if (
    client.state !== GameState.InGame ||
    client.typing ||
    (e.target !== ui && e.target !== canvas)
  ) {
    return;
  }

  if (
    [SitState.Floor, SitState.Chair].includes(
      client.getPlayerCharacter()!.sitState,
    )
  ) {
    client.stand();
    return;
  }

  if (client.selectedSpellId && client.mousePosition) {
    const spellRecord = client.getEsfRecordById(client.selectedSpellId);
    if (spellRecord) {
      const characterAt = getCharacterIntersecting(client.mousePosition);
      const npcAt = getNpcIntersecting(client.mousePosition);

      if (spellRecord.type === SkillType.Heal) {
        // Heal spells prioritize characters over NPCs
        if (characterAt) {
          const character = client.getCharacterById(characterAt.id);
          if (character) {
            client.clickCharacter(character);
            return;
          }
        }
        if (npcAt) {
          const npc = client.nearby.npcs.find((n) => n.index === npcAt.id);
          if (npc) {
            client.clickNpc(npc);
            return;
          }
        }
      } else {
        // Attack spells prioritize NPCs over characters
        if (npcAt) {
          const npc = client.nearby.npcs.find((n) => n.index === npcAt.id);
          if (npc) {
            client.clickNpc(npc);
            return;
          }
        }
        if (characterAt) {
          const character = client.getCharacterById(characterAt.id);
          if (character) {
            client.clickCharacter(character);
            return;
          }
        }
      }

      // Tile-based fallback: pixel hit detection missed, but there may be
      // a valid target on the clicked tile (e.g., hidden behind a tall NPC
      // sprite or slightly offset from its hit rectangle).
      if (client.mouseCoords) {
        const tileX = client.mouseCoords.x;
        const tileY = client.mouseCoords.y;

        const characterOnTile = client.nearby.characters.find(
          (c) =>
            c.playerId !== client.playerId &&
            c.coords.x === tileX &&
            c.coords.y === tileY,
        );
        const npcOnTile = client.nearby.npcs.find(
          (n) => n.coords.x === tileX && n.coords.y === tileY,
        );

        if (spellRecord.type === SkillType.Heal) {
          if (characterOnTile) {
            client.clickCharacter(characterOnTile);
            return;
          }
          if (npcOnTile) {
            client.clickNpc(npcOnTile);
            return;
          }
        } else {
          if (npcOnTile) {
            client.clickNpc(npcOnTile);
            return;
          }
          if (characterOnTile) {
            client.clickCharacter(characterOnTile);
            return;
          }
        }
      }
    }
  }

  if (client.mouseCoords) {
    // Check for items first
    const itemsAtCoords = client.nearby.items.filter(
      (i) =>
        i.coords.x === client.mouseCoords!.x &&
        i.coords.y === client.mouseCoords!.y,
    );

    if (itemsAtCoords.length) {
      itemsAtCoords.sort((a, b) => b.uid - a.uid);

      const protectedItems = itemsAtCoords.filter((i) => {
        const p = client.itemProtectionTimers.get(i.uid);
        return p && p.ticks > 0 && p.ownerId !== client.playerId;
      });

      if (protectedItems.length < itemsAtCoords.length) {
        const item = itemsAtCoords.find((i) => {
          const p = client.itemProtectionTimers.get(i.uid);
          return !p || p.ticks === 0 || p.ownerId === client.playerId;
        });

        if (item) {
          const packet = new ItemGetClientPacket();
          packet.itemIndex = item.uid;
          client.bus.send(packet);
        }

        return;
      }

      const protectedItem = protectedItems[0];
      const protection = client.itemProtectionTimers.get(protectedItem.uid);

      if (protection) {
        const owner = protection.ownerId
          ? client.getCharacterById(protection.ownerId)
          : undefined;

        const message = owner
          ? `${client.getResourceString(
              EOResourceID.STATUS_LABEL_ITEM_PICKUP_PROTECTED_BY,
            )} ${capitalize(owner.name)}`
          : client.getResourceString(
              EOResourceID.STATUS_LABEL_ITEM_PICKUP_PROTECTED,
            );

        client.setStatusLabel(
          EOResourceID.STATUS_LABEL_TYPE_WARNING,
          message ?? '',
        );

        const now = Date.now();
        if (message && now - lastProtectedToastAt > 1000) {
          lastProtectedToastAt = now;
          showGameToast(EOResourceID.STATUS_LABEL_TYPE_WARNING, message);
        }
        return;
      }
    }

    // Check tile specs for chests and chairs
    const tileSpec = client.map.tileSpecRows
      .find((r) => r.y === client.mouseCoords!.y)
      ?.tiles.find((t) => t.x === client.mouseCoords!.x)?.tileSpec;

    if (tileSpec !== undefined) {
      if (tileSpec === MapTileSpec.Chest) {
        client.openChest(client.mouseCoords);
        return;
      }

      if (
        client.isFacingChairAt(client.mouseCoords) &&
        !client.occupied(client.mouseCoords)
      ) {
        const coords = new Coords();
        coords.x = client.mouseCoords.x;
        coords.y = client.mouseCoords.y;
        client.sitChair(coords);
        return;
      }
    }
  }

  if (!client.mousePosition) {
    return;
  }

  const npcAt = getNpcIntersecting(client.mousePosition);
  if (npcAt) {
    const npc = client.nearby.npcs.find((n) => n.index === npcAt.id);
    if (npc) {
      client.clickNpc(npc);
      return;
    }
  }

  const characterAt = getCharacterIntersecting(client.mousePosition);
  if (characterAt) {
    const character = client.getCharacterById(characterAt.id);
    if (character) {
      client.clickCharacter(character);
      return;
    }
  }

  const doorAt = getDoorIntersecting(client.mousePosition!);
  const door = doorAt ? client.getDoor(doorAt) : undefined;
  if (door && !door.open) {
    client.openDoor(doorAt!);
  }

  const lockerAt = getLockerIntersecting(client.mousePosition!);
  if (lockerAt) {
    client.openLocker(lockerAt);
    return;
  }

  const signAt = getSignIntersecting(client.mousePosition!);
  if (signAt) {
    const sign = client.mapRenderer.getSign(signAt.x, signAt.y);
    if (sign) {
      client.emit('smallAlert', sign);
      return;
    }
  }

  const boardAt = getBoardIntersecting(client.mousePosition!);
  if (boardAt) {
    const boardSpec = client.boardAt(boardAt);
    if (boardSpec !== undefined) {
      client.openBoard(boardSpec - MapTileSpec.Board1);
    }
    return;
  }

  if (
    !client.cursorClickAnimation &&
    client.mouseCoords &&
    client.canWalk(client.mouseCoords, true)
  ) {
    client.cursorClickAnimation = new CursorClickAnimation(client.mouseCoords);

    const path = client.findPathTo(client.mouseCoords);
    if (path.length) {
      client.autoWalkPath = path;
    }
  }
}

export function handleRightClick(client: Client, e: MouseEvent): void {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('game');
  if (
    client.state !== GameState.InGame ||
    client.typing ||
    (e.target !== ui && e.target !== canvas)
  ) {
    return;
  }

  const characterAt = getCharacterIntersecting(client.mousePosition!);
  if (characterAt) {
    const character = client.getCharacterById(characterAt.id);
    if (character) {
      if (characterAt.id === client.playerId) {
        client.requestPaperdoll(client.playerId);
      } else {
        // Show HTML context menu at mouse position
        client.emit('showPlayerMenu', {
          playerId: character.playerId,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
    }
  }
}
