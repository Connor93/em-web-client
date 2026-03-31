export class ShieldMetadata {
  constructor(public back: boolean) {}
}

export function getShieldMetaData(): Map<number, ShieldMetadata> {
  return new Map([
    [10, new ShieldMetadata(true)], // good wings
    [11, new ShieldMetadata(true)], // bag
    [14, new ShieldMetadata(true)], // normal arrows
    [15, new ShieldMetadata(true)], // frost arrows
    [16, new ShieldMetadata(true)], // fire arrows
    [18, new ShieldMetadata(true)], // good force wings
    [19, new ShieldMetadata(true)], // fire force wings
    [26, new ShieldMetadata(true)], // dragon wings
    [27, new ShieldMetadata(true)], // custom wings
    [29, new ShieldMetadata(true)], // nightshade arrows
    [30, new ShieldMetadata(true)], // heaven wings
    [31, new ShieldMetadata(true)], // wasabi wings
  ]);
}
