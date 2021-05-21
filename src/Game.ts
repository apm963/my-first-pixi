import { Application, Loader, utils, Sprite, Rectangle, Text, TextStyle, Texture, Resource, settings, SCALE_MODES, Container } from "pixi.js";
import * as particles from 'pixi-particles';
import { torch } from './particles/fire';
import { calcCenter } from "./utils";

// TODO: Move these to this.loader
const loader = Loader.shared; // or create a dedicated one with `new Loader()`
const resources = loader.resources;

export class Game {
    
    app: Application;
    
    /** @description This is for images that do not have a texture atlas */
    static readonly imageFiles = {
        smokeParticle: 'assets/game/particles/smoke.png',
    };
    
    static readonly spriteSheetTextureAtlasFiles = {
        walls: 'assets/game/sprites/0x72_16x16DungeonTileset_walls.v2.json',
        main: 'assets/game/sprites/0x72_16x16DungeonTileset.v4.json',
    };
    
    worldScale = 4; // The zoom of the world
    
    constructor(
        /** @description Typically window.devicePixelRatio */
        public displayScalingOffset: number = 1,
        size: {width: number, height: number}
    ) {
        
        const displayScalingOffsetPerc = 1 / this.displayScalingOffset;
        
        // Create a Pixi Application
        this.app = new Application({
            // width: 256,
            // height: 256,
            resolution: displayScalingOffset, // 2 for retina,
            autoDensity: true,
            antialias: false,
        });
        
        // @ts-ignore
        this.app.renderer.autoResize = true;
        this.app.renderer.resize(size.width, size.height);
        
        // Support high DPI displays
        this.app.stage.scale.set(displayScalingOffsetPerc);
        
        settings.SCALE_MODE = SCALE_MODES.NEAREST;
        
        // TESTING: Tweaking
        this.app.renderer.backgroundColor = 0x061639;
        
    }
    
    setup() {
        // TODO
    }
    
    load(loadCb: (delta?: number) => void) {
        
        const app = this.app;
        
        // Loading indicator
        const loadingTextStyle = new TextStyle({ fill: 'white', fontSize: 36 * this.displayScalingOffset });
        const loadingText = new Text('', loadingTextStyle);
        app.stage.addChild(loadingText);
        
        const updateLoadingText = (progressPerc: any) => {
            loadingText.text = `Loading... ${progressPerc}%`;
            // loadingText.position.set((app.renderer.width / 2) - (loadingText.width / 2), (app.renderer.height / 2) - (loadingText.height / 2));
            loadingText.position.set(...calcCenter(loadingText, app.renderer));
        };
        
        updateLoadingText('0');
        
        // Load sprites
        loader.add(Object.values(Game.spriteSheetTextureAtlasFiles))
        Object.entries(Game.imageFiles).forEach(([key, url]) => loader.add(key, url));
        loader.load(loadCb);
        
        loader.onProgress.add(loader => updateLoadingText(loader.progress));
        loader.onComplete.once(() => loadingText.visible = false);
        
    }
    
}
