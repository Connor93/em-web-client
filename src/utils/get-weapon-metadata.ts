import { type Eif, ItemSubtype, ItemType } from 'eolib';
import { SfxId } from '../sfx';

export class WeaponMetadata {
  constructor(
    public slash: number | null,
    public sfx: SfxId[],
    public ranged: boolean,
  ) {}
}

interface WeaponMetadataJson {
  slash: number | null;
  sfx: number[];
  ranged: boolean;
  name: string;
}

type WeaponMetadataStore = Record<string, WeaponMetadataJson>;

const STORAGE_KEY = 'weapon-metadata-merged';

let weaponMetadataMap: Map<number, WeaponMetadata> = new Map();
let weaponNameMap: Map<number, string> = new Map();
let loadPromise: Promise<void> | null = null;

/**
 * Load weapon metadata from the static JSON file, then add any
 * auto-detected entries from localStorage that aren't already
 * in the JSON.
 *
 * The JSON file is always the source of truth for manually-configured
 * entries. localStorage only contributes entries that don't exist
 * in the JSON (i.e. auto-detected weapons from previous sessions).
 */
export async function loadWeaponMetadata(): Promise<void> {
  let base: WeaponMetadataStore = {};

  try {
    const response = await fetch('/weapon-metadata.json');
    if (response.ok) {
      base = await response.json();
    }
  } catch {
    console.warn('[WeaponMetadata] Failed to load weapon-metadata.json');
  }

  // Only add localStorage entries that are NEW (not in the base JSON).
  // This ensures the JSON file always takes precedence for configured weapons,
  // while auto-detected weapons from previous sessions are preserved.
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const merged: WeaponMetadataStore = JSON.parse(stored);
      for (const [key, entry] of Object.entries(merged)) {
        if (!(key in base)) {
          base[key] = entry;
        }
      }
    } catch {
      console.warn('[WeaponMetadata] Failed to parse stored weapon metadata');
    }
  }

  weaponMetadataMap = storeToMap(base);
  weaponNameMap = storeToNameMap(base);
}

/**
 * Start loading weapon metadata and return a promise that resolves
 * when loading is complete. Subsequent calls return the same promise.
 */
export function startLoadingWeaponMetadata(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadWeaponMetadata();
  }
  return loadPromise;
}

/**
 * Returns a promise that resolves when weapon metadata is loaded.
 * Must be called after startLoadingWeaponMetadata().
 */
export function waitForWeaponMetadata(): Promise<void> {
  return loadPromise || Promise.resolve();
}

/**
 * After the EIF is loaded, scan for any weapon graphic IDs that aren't
 * in the current metadata map. Auto-generate default entries for new
 * weapons using EIF data (subtype for ranged detection, name for labelling).
 * Persist the merged result to localStorage.
 */
export function syncWeaponMetadataWithEif(eif: Eif): void {
  const knownGraphicIds = new Set(weaponMetadataMap.keys());
  let changed = false;
  let weaponCount = 0;

  for (const record of eif.items) {
    if (record.type !== ItemType.Weapon) {
      continue;
    }

    weaponCount++;

    // spec1 is the "doll_graphic" — the weapon sprite ID that the server
    // sends as character.equipment.weapon. This is what our metadata map
    // is keyed by. (graphicId is the inventory icon, which is different)
    const dollGraphic = record.spec1;

    if (dollGraphic === 0) {
      continue;
    }

    // Update names from EIF for existing weapons that have no name yet
    if (knownGraphicIds.has(dollGraphic)) {
      if (!weaponNameMap.has(dollGraphic) || !weaponNameMap.get(dollGraphic)) {
        weaponNameMap.set(dollGraphic, record.name);
        changed = true;
      }
      continue;
    }

    const ranged = record.subtype === ItemSubtype.Ranged;
    const sfx = ranged ? [SfxId.AttackBow] : [SfxId.MeleeWeaponAttack];
    weaponMetadataMap.set(dollGraphic, new WeaponMetadata(0, sfx, ranged));
    weaponNameMap.set(dollGraphic, record.name);
    knownGraphicIds.add(dollGraphic);
    changed = true;

    console.log(
      `[WeaponMetadata] Auto-detected new weapon: dollGraphic=${dollGraphic} name="${record.name}" ranged=${ranged}`,
    );
  }

  console.log(
    `[WeaponMetadata] EIF sync complete. ${weaponCount} weapon items scanned, ${weaponMetadataMap.size} unique graphic IDs in metadata.`,
  );

  if (changed) {
    persistToLocalStorage();
  }
}

/**
 * Returns the current in-memory weapon metadata map.
 * This is called synchronously by consumers.
 */
export function getWeaponMetaData(): Map<number, WeaponMetadata> {
  return weaponMetadataMap;
}

/**
 * Export the full weapon metadata as a formatted JSON string.
 * Also triggers a file download of the JSON.
 */
export function exportWeaponMetadata(): string {
  const store: WeaponMetadataStore = {};
  const sortedKeys = [...weaponMetadataMap.keys()].sort((a, b) => a - b);

  for (const key of sortedKeys) {
    const meta = weaponMetadataMap.get(key)!;
    store[String(key)] = {
      slash: meta.slash,
      sfx: meta.sfx.map((s) => Number(s)),
      ranged: meta.ranged,
      name: weaponNameMap.get(key) || '',
    };
  }

  const json = JSON.stringify(store, null, 2);
  console.log('[WeaponMetadata] Exported weapon metadata:');
  console.log(json);

  // Trigger a file download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'weapon-metadata.json';
  a.click();
  URL.revokeObjectURL(url);

  return json;
}

// -- Internal helpers --

function storeToMap(store: WeaponMetadataStore): Map<number, WeaponMetadata> {
  const map = new Map<number, WeaponMetadata>();
  for (const [key, entry] of Object.entries(store)) {
    const graphicId = Number(key);
    map.set(
      graphicId,
      new WeaponMetadata(entry.slash, entry.sfx as SfxId[], entry.ranged),
    );
  }
  return map;
}

function storeToNameMap(store: WeaponMetadataStore): Map<number, string> {
  const map = new Map<number, string>();
  for (const [key, entry] of Object.entries(store)) {
    if (entry.name) {
      map.set(Number(key), entry.name);
    }
  }
  return map;
}

function persistToLocalStorage(): void {
  const store: WeaponMetadataStore = {};
  for (const [key, meta] of weaponMetadataMap) {
    store[String(key)] = {
      slash: meta.slash,
      sfx: meta.sfx.map((s) => Number(s)),
      ranged: meta.ranged,
      name: weaponNameMap.get(key) || '',
    };
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
