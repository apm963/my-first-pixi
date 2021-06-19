import { Container, DisplayObject, Sprite } from "pixi.js";
import { InteractableEntity } from "./InteractableEntity";
import { InventoryInstance } from "./Inventory";

export class CharacterEntity<T extends null | DisplayObject | Sprite | Container> extends InteractableEntity<T> {
    
    inventory: InventoryInstance[] = [];
    // REVIEW: Should we add dialog?
    
    addInventoryItem(inventoryItem: InventoryInstance) {
        this.inventory.push(inventoryItem);
    }
    
    removeInventoryItem(inventoryItem: InventoryInstance) {
        this.inventory = this.inventory.filter(existingItem => existingItem !== inventoryItem);
    }
    
    // TODO: Event listener binding for keyboard (?)
    
}