export { DialogIcon } from '../ui/dialog-icon';

export enum SlotType {
  Empty = 0,
  Item = 1,
  Skill = 2,
}

export interface ISlot {
  type: SlotType;
  typeId: number;
}
