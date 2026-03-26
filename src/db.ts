import { Ecf, Eif, Emf, Enf, EoReader, EoWriter, Esf } from 'eolib';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { Edf } from './edf';
import { padWithZeros } from './utils';

declare const __BUILD_VERSION__: string;

type PubsKey = 'eif' | 'enf' | 'ecf' | 'esf';

interface DB extends DBSchema {
  pubs: {
    key: PubsKey;
    value: Uint8Array;
  };
  maps: {
    key: number;
    value: Uint8Array;
  };
  edfs: {
    key: number;
    value: Uint8Array;
  };
  meta: {
    key: string;
    value: string;
  };
}

let dbPromise: Promise<IDBPDatabase<DB>>;

function getDb(): Promise<IDBPDatabase<DB>> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDB<DB>('db', 3, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('pubs')) {
            db.createObjectStore('pubs');
          }
          if (!db.objectStoreNames.contains('maps')) {
            db.createObjectStore('maps');
          }
          if (!db.objectStoreNames.contains('edfs')) {
            db.createObjectStore('edfs');
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
          }
        },
      });

      // Check build version — clear stale caches on mismatch
      try {
        const storedVersion = await db.get('meta', 'buildVersion');
        if (storedVersion !== __BUILD_VERSION__) {
          console.log(
            `Build version changed (${storedVersion ?? 'none'} → ${__BUILD_VERSION__}), clearing cached data`,
          );
          await db.clear('pubs');
          await db.clear('maps');
          await db.clear('edfs');
          await db.put('meta', __BUILD_VERSION__, 'buildVersion');
        }
      } catch (e) {
        console.warn('Failed to check build version, clearing caches', e);
        try {
          await db.clear('pubs');
          await db.clear('maps');
          await db.clear('edfs');
          await db.put('meta', __BUILD_VERSION__, 'buildVersion');
        } catch (_) {
          // best effort
        }
      }

      return db;
    })();
  }
  return dbPromise;
}

export async function getEmf(id: number): Promise<Emf | null> {
  const db = await getDb();
  const buf = await db.get('maps', id);
  if (!buf) {
    console.log(
      `[DB DEBUG] getEmf(${id}): NOT in IndexedDB, will fetch from server`,
    );
    return null;
  }

  try {
    const reader = new EoReader(buf);
    const emf = Emf.deserialize(reader);
    console.log(`[DB DEBUG] getEmf(${id}): loaded from IndexedDB`, {
      name: emf.name,
      fillTile: emf.fillTile,
      graphicLayers: emf.graphicLayers.length,
      graphicLayerTileCounts: emf.graphicLayers.map((l) =>
        l.graphicRows.reduce(
          (sum, r) => sum + r.tiles.filter((t) => t.graphic).length,
          0,
        ),
      ),
    });
    return emf;
  } catch (e) {
    console.warn(`Corrupt cached map ${id}, clearing`, e);
    await db.delete('maps', id);
    return null;
  }
}

export function saveEmf(id: number, emf: Emf) {
  getDb().then((db) => {
    const writer = new EoWriter();
    Emf.serialize(writer, emf);
    db.put('maps', writer.toByteArray(), id);
  });
}

export async function getEdf(id: number): Promise<Edf | null> {
  const db = await getDb();
  const buf = await db.get('edfs', id);
  if (!buf) {
    const response = await fetch(`/data/dat${padWithZeros(id, 3)}.edf`);
    if (!response.ok) {
      return null;
    }

    const data = await response.arrayBuffer();
    const buf = new Uint8Array(data);

    db.put('edfs', buf, id);

    try {
      return Edf.deserialize(new Uint8Array(data));
    } catch (e) {
      console.warn(`Failed to deserialize fetched EDF ${id}`, e);
      return null;
    }
  }

  try {
    return Edf.deserialize(buf);
  } catch (e) {
    console.warn(`Corrupt cached EDF ${id}, clearing`, e);
    await db.delete('edfs', id);
    return null;
  }
}

export async function getEif(): Promise<Eif | null> {
  const db = await getDb();
  const buf = await db.get('pubs', 'eif');
  if (!buf) {
    return null;
  }

  try {
    const reader = new EoReader(buf);
    return Eif.deserialize(reader);
  } catch (e) {
    console.warn('Corrupt cached EIF, clearing', e);
    await db.delete('pubs', 'eif');
    return null;
  }
}

export function saveEif(eif: Eif) {
  getDb().then((db) => {
    const writer = new EoWriter();
    Eif.serialize(writer, eif);
    db.put('pubs', writer.toByteArray(), 'eif');
  });
}

export async function getEcf(): Promise<Ecf | null> {
  const db = await getDb();
  const buf = await db.get('pubs', 'ecf');
  if (!buf) {
    return null;
  }

  try {
    const reader = new EoReader(buf);
    return Ecf.deserialize(reader);
  } catch (e) {
    console.warn('Corrupt cached ECF, clearing', e);
    await db.delete('pubs', 'ecf');
    return null;
  }
}

export function saveEcf(ecf: Ecf) {
  getDb().then((db) => {
    const writer = new EoWriter();
    Ecf.serialize(writer, ecf);
    db.put('pubs', writer.toByteArray(), 'ecf');
  });
}

export async function getEnf(): Promise<Enf | null> {
  const db = await getDb();
  const buf = await db.get('pubs', 'enf');
  if (!buf) {
    return null;
  }

  try {
    const reader = new EoReader(buf);
    return Enf.deserialize(reader);
  } catch (e) {
    console.warn('Corrupt cached ENF, clearing', e);
    await db.delete('pubs', 'enf');
    return null;
  }
}

export function saveEnf(enf: Enf) {
  getDb().then((db) => {
    const writer = new EoWriter();
    Enf.serialize(writer, enf);
    db.put('pubs', writer.toByteArray(), 'enf');
  });
}

export async function getEsf(): Promise<Esf | null> {
  const db = await getDb();
  const buf = await db.get('pubs', 'esf');
  if (!buf) {
    return null;
  }

  try {
    const reader = new EoReader(buf);
    return Esf.deserialize(reader);
  } catch (e) {
    console.warn('Corrupt cached ESF, clearing', e);
    await db.delete('pubs', 'esf');
    return null;
  }
}

export function saveEsf(esf: Esf) {
  getDb().then((db) => {
    const writer = new EoWriter();
    Esf.serialize(writer, esf);
    db.put('pubs', writer.toByteArray(), 'esf');
  });
}
