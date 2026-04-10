import { Emf, EoReader } from 'eolib';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

interface MapEntry {
  id: number;
  name: string;
}

function generateManifest(mapsDirectory: string): MapEntry[] {
  const entries: MapEntry[] = [];
  const files = readdirSync(mapsDirectory).filter((file) =>
    file.endsWith('.emf'),
  );

  for (const file of files) {
    const id = Number.parseInt(file.replace('.emf', ''), 10);
    if (Number.isNaN(id)) continue;

    try {
      const buffer = new Uint8Array(readFileSync(resolve(mapsDirectory, file)));
      const reader = new EoReader(buffer);
      const emf = Emf.deserialize(reader);
      const name = emf.name?.trim() || `Map ${id}`;
      entries.push({ id, name });
    } catch {
      console.warn(`[map-manifest] Skipping ${file} (failed to parse)`);
    }
  }

  entries.sort((a, b) => a.id - b.id);
  return entries;
}

export function mapManifestPlugin(): Plugin {
  let root: string;

  return {
    name: 'map-manifest',

    configResolved(config) {
      root = config.root;
    },

    configureServer() {
      const mapsDirectory = resolve(root, 'public', 'maps');
      const manifest = generateManifest(mapsDirectory);
      const outputPath = resolve(root, 'public', 'map-manifest.json');
      writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
      console.log(
        `[map-manifest] Generated manifest with ${manifest.length} maps (dev)`,
      );
    },

    closeBundle() {
      const mapsDirectory = resolve(root, 'public', 'maps');
      const manifest = generateManifest(mapsDirectory);
      const outputPath = resolve(root, 'dist', 'map-manifest.json');
      writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
      console.log(
        `[map-manifest] Generated manifest with ${manifest.length} maps (build)`,
      );
    },
  };
}
