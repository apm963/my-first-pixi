import { Container, DisplayObject, Sprite } from "pixi.js";
import { InteractableEntity } from "./InteractableEntity";

export interface InventoryItem {
    name: string;
    ident: string; // Or maybe "classifier"
    qty: number;
    maxQty: number;
    sprite: Sprite | Container;
}

export class CharacterEntity<T extends null | DisplayObject | Sprite | Container> extends InteractableEntity<T> {
    
    inventory: InventoryItem[] = [];
    // REVIEW: Should we add dialog?
    
    addInventoryItem(inventoryItem: InventoryItem) {
        this.inventory.push(inventoryItem);
    }
    
    removeInventoryItem(inventoryItem: InventoryItem) {
        this.inventory = this.inventory.filter(existingItem => existingItem !== inventoryItem);
    }
    
    // TODO: Event listener binding for keyboard (?)
    
}