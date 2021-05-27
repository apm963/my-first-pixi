import { Container } from "@pixi/display";
import { Game } from "./Game";

export interface GameSceneIface<O> {
    
    game: Game;
    sceneContainer: Container;
    items: O;
    
}

export abstract class GameSceneBase {
    
    sceneContainer = new Container();
    
    addToGame(stage: Container) {
        stage.addChild(this.sceneContainer);
        return this;
    }
    
    removeFromGame(stage: Container) {
        stage.removeChild(this.sceneContainer);
        return this;
    }
    
}
