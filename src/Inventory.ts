import { Container, Sprite } from "pixi.js";
import { v4 as uuidv4 } from 'uuid';

export interface InventoryItemDefinition {
    name: string;
    maxQty: number;
    sprite: Sprite | Container;
}

export interface InventoryInstance extends InventoryItemDefinition {
    qty: number;
    uuid: string;
    // TODO: Add modifiers (eg. damage modifier, power/upgrade multiplier, etc.)
};

/** @description Inventory management system */
export class Inventory {
    
    items: InventoryInstance[] = [];
    maxSlots: number = 99;
    slots: number[] = [];
    
    addItem(inventoryItem: InventoryInstance) {
        this.items.push(inventoryItem);
    }
    
    removeItem(inventoryItem: InventoryInstance) {
        this.items = this.items.filter(existingItem => existingItem !== inventoryItem);
    }
    
    getItemInSlot(slot: number): InventoryInstance | null {
        // TODO: Make this actually work off of slots. For now it's just using index but that is not likely to be the final approach.
        return this.items[slot] ?? null;
    }
    
    static createItemFromDefinition(definition: InventoryItemDefinition, qty: number): InventoryInstance {
        return {
            ...definition,
            qty,
            uuid: uuidv4(),
        };
    }
    
}
