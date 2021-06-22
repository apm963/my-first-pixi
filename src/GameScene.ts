import { Container } from "@pixi/display";
import { DisplayObject } from "pixi.js";
import { Game } from "./Game";
import { InteractableEntity } from "./InteractableEntity";
import { SceneEntity } from "./SceneEntity";

interface BaseSceneIface<O> {
    
    game: Game;
    sceneContainer: Container;
    items: O;
    
    getItemsFlat: () => (Container | InteractableEntity<any> | SceneEntity<any>)[];
    onTick: (delta: number) => void;
    
}

export interface GameSceneIface<O> extends BaseSceneIface<O> {
    getSolidObjects: () => (DisplayObject | InteractableEntity<any>)[];
}

export interface UiSceneIface<O> extends BaseSceneIface<O> {
    getClickableObjects: () => unknown[]; // TODO: Define
}

export abstract class GameSceneBase {
    
    sceneContainer = new Container();
    static mapSize: { width: number; height: number };
    
    addToGame(stage: Container) {
        stage.addChild(this.sceneContainer);
        return this;
    }
    
    removeFromGame(stage: Container) {
        stage.removeChild(this.sceneContainer);
        return this;
    }
    
}
