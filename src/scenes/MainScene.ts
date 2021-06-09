import { Container } from "@pixi/display";
import { CharacterObject } from "../CharacterObject";
import { Game } from "../Game";
import { GameSceneBase, GameSceneIface } from "../GameScene";



// TODO: Clean these up and merge them with above. Use @pixi/* if possible.
import { Application, Loader, utils, Sprite, Rectangle, Text, TextStyle, Texture, Resource, settings, SCALE_MODES } from "pixi.js";
import * as particles from 'pixi-particles';
import { torch } from '../particles/fire';
import { calcCenter, calcScaledPos, createDebugOverlay, randomTrue, tau } from "../utils";
import { InteractableObject } from "../InteractableObject";
import { SceneObject } from "../SceneObject";




type SceneObjects = {
    playerChar: CharacterObject;
    npcChar: CharacterObject;
    floor: Container;
    walls: (Sprite | Container)[]; // TODO: Make InteractableObject
    door: Sprite[]; // TODO: Make InteractableObject
    torch: {
        base: InteractableObject;
        fire: Container;
        fireEmitter: particles.Emitter;
    };
    actions: InteractableObject[];
};

export class MainScene extends GameSceneBase implements GameSceneIface<SceneObjects> {
    
    items: SceneObjects;
    sceneContainer = new Container();
    
    onTickCbArr: ((delta: number) => void)[] = [];
    
    static mapSize = { width: 10, height: 10 };
    
    constructor(
        public game: Game,
        public resources: Loader['resources']
    ) {
        super();
        
        this.items = this.generateObjects();
        
    }
    
    getItemsFlat(): (Container | SceneObject)[] {
        return [
            this.items.playerChar,
            this.items.npcChar,
            this.items.floor,
            ...this.items.walls,
            ...this.items.door,
            this.items.torch.base,
            this.items.torch.fire,
            ...this.items.actions,
        ];
    }
    
    generateObjects(): SceneObjects {
        
        const { game, resources } = this;
        const { mapSize } = MainScene;
        const { displayScalingOffset, worldScale } = game;
        const { spriteSheetTextureAtlasFiles, tileSize, playerMaxVelocity } = Game;
        
        // Create scene that contains all of the objects we want to render. This greatly simplifies scaling, positioning, and handling device pixel ratio.
        const sceneContainer = this.sceneContainer;
        sceneContainer.scale.set(displayScalingOffset * worldScale);
        sceneContainer.sortableChildren = true;
        
        const wallSheet = resources[spriteSheetTextureAtlasFiles.walls]?.textures ?? {};
        const mainSheet = resources[spriteSheetTextureAtlasFiles.main]?.textures ?? {};
        
        const generateSpritesFromAtlasMap = (mapRowsCols: ((string | null)[] | null)[], zIndex?: number): Sprite[] => {
            const sprites: Sprite[] = [];
            
            mapRowsCols.forEach((mapRow, row) => {
                (mapRow ?? []).forEach((mapCell, col) => {
                    if (mapCell === null) {
                        // Skip this cell
                        return;
                    }
                    const sprite = new Sprite(wallSheet[mapCell]);
                    sprite.position.set(col * tileSize, row * tileSize);
                    if (typeof zIndex === 'number') {
                        sprite.zIndex = zIndex;
                    }
                    sprites.push(sprite);
                });
            });
            
            return sprites;
        }
        
        const backgroundWallMap: string[][] = [
            // ['wallRightMiddle', ...Array(6).fill(null), 'wallTopLeft', 'wall1Top', 'wall1Top'],
            // ['wallBottomLeftEnd', 'wall1Top', 'wall1Top', 'wallDoorLeftTop', null, null, 'wallDoorRightTop', 'wall2Left', 'wall2', 'wall2'],
            // ['wall1Left', 'wall1', 'wall1', 'wallDoorLeft', null, null, 'wallDoorRight', 'wallEndRight'],
            ['wallRightMiddle', ...Array(6).fill(null), 'wallTopLeft', 'wall1Top', 'wall1Top'],
            ['wallBottomLeftEnd', 'wall1Top', 'wall1Top', 'wallDoorLeftTop', 'doorTopLeft', 'doorTopRight', 'wallDoorRightTop', 'wall2Left', 'wall2', 'wall2'],
            ['wall1Left', 'wall1', 'wall1', 'wallDoorLeft', 'doorBottomLeft', 'doorBottomRight', 'wallDoorRight', 'wallEndRight'],
        ];
        
        const backgroundFloorMap: string[][] = Array(mapSize.height)
            .fill(null)
            .map(() => Array(mapSize.width).fill('floorTile'));
        
        const actions: InteractableObject[] = [];
        
        // Convert some to tiles to dirt floor
        backgroundFloorMap[0] = ['floorDirtTopLeft', ...Array(mapSize.width - 2).fill('floorDirtTop'), 'floorDirtTopRight'];
        backgroundFloorMap[1] = ['floorDirtLeft', ...Array(mapSize.width - 2).fill('wallSprite60'), 'floorDirtRight'];
        
        // Add ladder
        backgroundFloorMap[1][2] = 'floorLadder';
        
        // Manually make some floor tiles broken
        backgroundFloorMap[3][2] = backgroundFloorMap[4][5] = 'floorTileCracked';
        
        // Randomly make some more floor tiles broken
        backgroundFloorMap.forEach((rowMap, r) => (rowMap ?? []).forEach((spriteName, c) => {
            if (spriteName === 'floorTile' && randomTrue(0.05)) {
                backgroundFloorMap[r][c] = 'floorTileCracked';
            }
        }));
        
        // Generate wall sprites and add to stage
        const upperItemFrameNames = ['wallTopLeft', 'wall1Top', 'wallDoorLeftTop', 'wallDoorRightTop', 'doorTopLeft', 'doorTopRight', 'openDoorTopLeft', 'openDoorTopRight', 'openDoorBottomLeft', 'openDoorBottomRight'];
        const isUpperItem = (frameName: string) => upperItemFrameNames.includes(frameName);
        
        const wallLowerContainer = new Container();
        wallLowerContainer.zIndex = 2;
        const wallLowerSprites = generateSpritesFromAtlasMap(backgroundWallMap.map(row => row.map(frameName => !isUpperItem(frameName) ? frameName : null)))
        wallLowerSprites.forEach(sprite => wallLowerContainer.addChild(sprite));
        
        const wallUpperContainer = new Container();
        wallUpperContainer.zIndex = 20;
        const wallUpperSprites = generateSpritesFromAtlasMap(backgroundWallMap.map(row => row.map(frameName => isUpperItem(frameName) ? frameName : null)))
        wallUpperSprites.forEach(sprite => wallUpperContainer.addChild(sprite));
        
        sceneContainer.addChild(wallLowerContainer);
        sceneContainer.addChild(wallUpperContainer);
        
        // Generate floor sprites and add to stage
        const floorContainer = new Container();
        floorContainer.zIndex = 1;
        
        generateSpritesFromAtlasMap(backgroundFloorMap).forEach(sprite => {
            if (sprite.texture.textureCacheIds.includes('floorTileCracked')) {
                const {width, height, position} = sprite;
                const {x, y} = position;
                
                const rotationInt = Math.floor(Math.random() * 4);
                
                sprite.anchor.set(0.5, 0.5);
                sprite.position.set(x + (width / 2), y + (height / 2));
                sprite.rotation = ((Math.PI / 2) * rotationInt) % tau;
                
                // sprite.anchor.set(0, 0);
            }
            floorContainer.addChild(sprite);
        });
        
        sceneContainer.addChild(floorContainer);
        
        // Add actions (door open, etc.)
        let doorOpen = false;
        const doorTiles = [...wallUpperSprites, ...wallLowerSprites]
            .filter(sprite => sprite.texture.textureCacheIds.some(frameName => /^door/.test(frameName)));
        
        const actionOpenDoor = (collisionItems: InteractableObject[]) => {
            if (doorOpen) { return; }
            doorTiles
                .forEach(sprite => {
                    
                    // Swap out sprite with corresponding open door sprite
                    const currentTextureFrameName: string = sprite.texture.textureCacheIds.filter(frameName => /^door/.test(frameName))[0] ?? '';
                    const newTextureFrameName = `open${currentTextureFrameName.substr(0, 1).toUpperCase()}${currentTextureFrameName.substr(1)}`;
                    sprite.texture = wallSheet[newTextureFrameName];
                    
                    // Move sprites to different container for collision purposes
                    if (sprite.parent === wallLowerContainer) {
                        wallUpperContainer.addChild(sprite);
                    }
                });
            doorOpen = true;
        };
        
        const doorAction = new InteractableObject();
        doorAction.x = Math.min(...doorTiles.map(doorTile => doorTile.x));
        doorAction.y = Math.max(...doorTiles.map(doorTile => doorTile.y + doorTile.height));
        doorAction.width = tileSize * 2;
        doorAction.height = tileSize / 2;
        doorAction.addEventListener('collision', actionOpenDoor, {once: true});
        
        actions.push(doorAction);
        
        // Add player character
        const playerContainer = new Container();
        playerContainer.zIndex = 11; // This goes above the wall, floor, and npc sprites
        
        const playerSprite = new Sprite(mainSheet['characterBeard']);
        playerSprite.anchor.set(0.5, 0.5);
        playerSprite.position.set(...calcCenter(null, playerSprite));
        playerContainer.position.set(...calcScaledPos(2, 6, tileSize));
        playerContainer.addChild(playerSprite);
        
        const playerBoundingBoxDebugOverlay = createDebugOverlay(playerContainer, sceneContainer);
        playerBoundingBoxDebugOverlay.zIndex = 12;
        playerBoundingBoxDebugOverlay.visible = false;
        
        const playerChar = new CharacterObject({ item: playerContainer, mirrorTarget: playerSprite });
        playerChar.setBoundingBox({x: 2, width: -3}, {mode: 'offset', target: playerSprite, boundingBoxDebugOverlay: playerBoundingBoxDebugOverlay});
        playerChar.addTo(sceneContainer);
        playerChar.velocity.vx = 0;
        playerChar.velocity.vy = 0;
        playerChar.maxVelocity.vx = playerMaxVelocity;
        playerChar.maxVelocity.vy = playerMaxVelocity;
        
        // Add NPCs
        const npcContainer = new Container();
        npcContainer.zIndex = 10; // This goes above the wall and floor sprites
        
        const npcSprite = new Sprite(mainSheet['characterEyePatch']);
        npcSprite.anchor.set(0.5, 0.5);
        npcSprite.scale.x *= -1;
        npcSprite.position.set(...calcCenter(null, playerSprite));
        npcContainer.position.set(...calcScaledPos((mapSize.width - 4), 0, tileSize));
        npcContainer.addChild(npcSprite);
        // createDebugOverlay(npcContainer);
        
        const npcChar = new CharacterObject({item: npcContainer});
        npcChar.setBoundingBox({ x: npcContainer.x + 3, width: tileSize - 6, height: 10 }, {mode: 'absolute'});
        npcChar.addTo(sceneContainer);
        
        
        
        // Add torch
        const torchSprite = new Sprite(mainSheet['torchBottom0']);
        torchSprite.position.set(7 * tileSize, 3 * tileSize);
        torchSprite.zIndex = 8;
        
        const torchObj = new InteractableObject({ item: torchSprite });
        torchObj.setBoundingBox({ x: 4, width: -8, height: -2 }, { mode: 'offset' });
        torchObj.addTo(sceneContainer);
        
        // Add fire
        const torchFireContainer = new Container();
        torchFireContainer.position.set(7.5 * tileSize, 3.1 * tileSize); // Position the particle origin nicely on the torch
        torchFireContainer.zIndex = 99;
        torchFireContainer.scale.set(0.2);
        const torchFireEmitter = new particles.Emitter(
            torchFireContainer,
            [Texture.from('smokeParticle')],
            torch
        );
        torchFireEmitter.emit = true; // Start emitting
        sceneContainer.addChild(torchFireContainer);
        
        /** @description Setting this allows you to skip the partical initiation and bloom phase when this scene first loads. Good for fire. */
        const particleStartOffsetMs = 3000;
        let particleElapsed = Date.now() - Math.max(particleStartOffsetMs, 0);
        // Update function every frame
        const updateParticleOnTick = (delta: number) => {
            const now = Date.now();
            // The emitter requires the elapsed number of seconds since the last update
            torchFireEmitter.update((now - particleElapsed) * 0.0002);
            particleElapsed = now;
        };
        this.onTickCbArr.push(updateParticleOnTick);
        
        return {
            playerChar,
            npcChar,
            floor: floorContainer,
            walls: [wallLowerContainer, wallUpperContainer],
            door: [...wallUpperSprites, ...wallLowerSprites].filter(sprite => sprite.texture.textureCacheIds.some(frameName => /^door/.test(frameName))), // TODO: Refactor so this is a dedicated section / container
            torch: {
                base: torchObj,
                fire: torchFireContainer,
                fireEmitter: torchFireEmitter,
            },
            actions,
        };
    }
    
    onTick(delta: number) {
        this.onTickCbArr.forEach(cb => cb(delta));
    }
    
}