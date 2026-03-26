import { DIBReader } from './dib-reader';
import { LoadType } from './load-type';
import { PEReader } from './pe-reader';

const egfs = new Map<number, PEReader>();

function loadDIB(data: { fileID: number; resourceID: number }) {
  // Hat GFX files (15, 16) may use either (0,0,0) or (8,0,0) as their
  // transparency color. We detect which one by scanning the raw DIB data
  // for (8,0,0) pixels — if found, use that; otherwise fall back to (0,0,0).
  // We cannot use both because (0,0,0) pixels serve as hair-clipping masks
  // in hats that use (8,0,0) for background transparency.
  let transparentColors: number[][] = [[0, 0, 0]];
  try {
    const egf = egfs.get(data.fileID);
    if (egf) {
      const info = egf.getResourceInfo(data.resourceID);
      if (info) {
        const dib = egf.readResource(info);

        // For hat GFX files, detect the correct transparency color.
        // Some hats use (8,0,0) as background; those need (0,0,0) kept
        // opaque for hair clipping. Others use standard (0,0,0).
        // Scan the decoded pixels for any (8,0,0) — if found, that's
        // the background color.
        if ([15, 16].includes(data.fileID)) {
          const probe = new DIBReader(dib, []);
          const probePixels = probe.read();
          for (let i = 0; i < probePixels.length; i += 4) {
            if (
              probePixels[i] === 8 &&
              probePixels[i + 1] === 0 &&
              probePixels[i + 2] === 0
            ) {
              transparentColors = [[8, 0, 0]];
              break;
            }
          }
        }

        const reader = new DIBReader(dib, transparentColors);
        const pixels = reader.read();
        postMessage(
          {
            loadType: LoadType.DIB,
            fileID: data.fileID,
            resourceID: data.resourceID,
            pixels: pixels.buffer,
            width: info.width,
            height: Math.abs(info.height),
          },
          // @ts-expect-error transferable
          [pixels.buffer],
        );
        return;
      }
    }
    postMessage({
      loadType: LoadType.DIB,
      fileID: data.fileID,
      resourceID: data.resourceID,
      error: `Resource ${data.resourceID} not found in EGF ${data.fileID}`,
    });
  } catch (e) {
    postMessage({
      loadType: LoadType.DIB,
      fileID: data.fileID,
      resourceID: data.resourceID,
      error: String(e),
    });
  }
}

function loadEGF(data: { fileID: number; buffer: ArrayBuffer }) {
  try {
    if (egfs.has(data.fileID)) {
      throw new Error(`EGF ${data.fileID} was already loaded.`);
    }

    const egf = new PEReader(data.buffer);
    egfs.set(data.fileID, egf);

    postMessage({
      loadType: LoadType.EGF,
      fileID: data.fileID,
      resourceInfo: egf.resourceInfo,
    });
  } catch (e) {
    postMessage({
      loadType: LoadType.EGF,
      fileID: data.fileID,
      error: String(e),
    });
  }
}

self.onmessage = (event: MessageEvent) => {
  const data = event.data;
  switch (data.loadType) {
    case LoadType.DIB:
      loadDIB(data);
      break;
    case LoadType.EGF:
      loadEGF(data);
      break;
    default:
      throw new Error(`Unhandled LoadType: ${data.loadType}`);
  }
};
