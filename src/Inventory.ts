import { Container, Sprite } from "pixi.js";
import { v4 as uuidv4 } from 'uuid';

export interface InventoryItemDefinition {
    name: string;
    maxQty: number;
    sprite: Sprite | Container;
}

export type InventoryInstance = InventoryItemDefinition & {
    qty: number;
    uuid: string;
    // TODO: Add modifiers (eg. damage modifier, power/upgrade multiplier, etc.)
};

export function createInventoryItem(definition: InventoryItemDefinition, qty: number): InventoryInstance {
    return {
        ...definition,
        qty,
        uuid: uuidv4(),
    };
}
