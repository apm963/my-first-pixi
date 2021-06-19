import { Container, DisplayObject, Sprite } from "pixi.js";
import { InteractableEntity } from "./InteractableEntity";
import { Inventory, InventoryInstance } from "./Inventory";

export class CharacterEntity<T extends null | DisplayObject | Sprite | Container> extends InteractableEntity<T> {
    
    inventory: Inventory = new Inventory();
    // REVIEW: Should we add dialog?
    
    // TODO: Event listener binding for keyboard (?)
    
}