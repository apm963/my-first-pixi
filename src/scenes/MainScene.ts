import { DisplayObject, Loader, Sprite, Texture } from "pixi.js";
import { Container } from "@pixi/display";
import * as particles from 'pixi-particles';

import { CharacterEntity } from "../CharacterEntity";
import { Game } from "../Game";
import { GameSceneBase, GameSceneIface } from "../GameScene";
import { torch } from '../particles/fire';
import { calcCenter, calcScaledPos, calcZFromGeometry, createDebugOverlay, randomTrue, tau } from "../utils";
import { CollisionInfo, InteractableEntity, Velocity } from "../InteractableEntity";
import { SceneEntity } from "../SceneEntity";

type SceneObjects = {
    playerChar: CharacterEntity;
    npcChar: CharacterEntity;
    floor: Container;
    walls: InteractableEntity[];
    door: SceneEntity;
    ladder: InteractableEntity;
    torch: {
        base: InteractableEntity;
        fire: Container;
        fireEmitter: particles.Emitter;
    };
    actions: InteractableEntity[];
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
    
    getItemsFlat(): (Container | InteractableEntity | SceneEntity)[] {
        return [
            this.items.playerChar,
            this.items.npcChar,
            this.items.floor,
            ...this.items.walls,
            this.items.door,
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
        const zBindingMultiplier = 1 / tileSize;
        const charEntHitboxHeight = 6;
        
        // Create scene that contains all of the objects we want to render. This greatly simplifies scaling, positioning, and handling device pixel ratio.
        const sceneContainer = this.sceneContainer;
        sceneContainer.scale.set(displayScalingOffset * worldScale);
        sceneContainer.sortableChildren = true;
        
        const wallSheet = resources[spriteSheetTextureAtlasFiles.walls]?.textures ?? {};
        const mainSheet = resources[spriteSheetTextureAtlasFiles.main]?.textures ?? {};
        
        type GenerateSpritesFromAtlasMap = {
            (mapRowsCols: ((string | null)[] | null)[], zIndex?: number): Sprite[];
            <T extends SceneEntity>(mapRowsCols: ((string | null)[] | null)[], zIndex: number, wrapperClass: new (opts: { item: Container }) => T): T[];
        };
        
        const generateSpritesFromAtlasMap: GenerateSpritesFromAtlasMap = <T extends SceneEntity>(mapRowsCols: ((string | null)[] | null)[], zIndex?: number, wrapperClass?: new (opts: {item: Container}) => T) => {
            const sprites: (Sprite | T)[] = [];
            
            mapRowsCols.forEach((mapRow, row) => {
                (mapRow ?? []).forEach((mapCell, col) => {
                    if (mapCell === null) {
                        // Skip this cell
                        return;
                    }
                    const sprite = new Sprite(wallSheet[mapCell]);
                    const spriteOrWrapper: Sprite | T = (wrapperClass ? new wrapperClass({item: sprite}) : sprite);
                    // spriteOrWrapper.position.set(col * tileSize, row * tileSize);
                    spriteOrWrapper.x = col * tileSize;
                    spriteOrWrapper.y = row * tileSize;
                    if (typeof zIndex === 'number') {
                        spriteOrWrapper.zIndex = zIndex;
                    }
                    sprites.push(spriteOrWrapper);
                });
            });
            
            return sprites;
        };
        
        const backgroundWallMap: string[][] = [
            ['wallRightMiddle', ...Array(6).fill(null), 'wallTopLeft', 'wall1Top', 'wall1Top'],
            ['wallBottomLeftEnd', 'wall1Top', 'wall1Top', 'wallDoorLeftTop', null, null, 'wallDoorRightTop', 'wall2Left', 'wall2', 'wall2'],
            ['wall1Left', 'wall1', 'wall1', 'wallDoorLeft', null, null, 'wallDoorRight', 'wallEndRight'],
        ];
        
        const backgroundFloorMap: string[][] = Array(mapSize.height)
            .fill(null)
            .map(() => Array(mapSize.width).fill('floorTile'));
        
        const actions: InteractableEntity[] = [];
        
        // Convert some to tiles to dirt floor
        backgroundFloorMap[0] = ['floorDirtTopLeft', ...Array(mapSize.width - 2).fill('floorDirtTop'), 'floorDirtTopRight'];
        backgroundFloorMap[1] = ['floorDirtLeft', ...Array(mapSize.width - 2).fill('wallSprite60'), 'floorDirtRight'];
        backgroundFloorMap[2] = ['floorDirtLeft', ...Array(mapSize.width - 4).fill('wallSprite60'), ...Array(3).fill('floorTile')];
        
        // Manually make some floor tiles broken
        backgroundFloorMap[3][2] = backgroundFloorMap[4][5] = 'floorTileCracked';
        
        // Randomly make some more floor tiles broken
        backgroundFloorMap.forEach((rowMap, r) => (rowMap ?? []).forEach((spriteName, c) => {
            if (spriteName === 'floorTile' && randomTrue(0.05)) {
                backgroundFloorMap[r][c] = 'floorTileCracked';
            }
        }));
        
        // Generate wall sprites and add to stage
        const upperItemFrameNames = ['wallTopLeft', 'wall1Top', 'wallDoorLeftTop', 'wallDoorRightTop'];
        const isUpperItem = (frameName: string) => upperItemFrameNames.includes(frameName);
        
        const wallEntities = generateSpritesFromAtlasMap(backgroundWallMap, 0, InteractableEntity);
        wallEntities
            .filter(ent => ent.item && ent.item instanceof Sprite && isUpperItem(ent.item.texture.textureCacheIds[0]))
            .forEach(wallEntity => wallEntity.boundingBoxEnabled = false);
        wallEntities.forEach(wallEntity => {
            wallEntity.bindZToY = true;
            wallEntity.zBindingMultiplier = zBindingMultiplier;
            wallEntity.y = wallEntity.y; // Force y change to make z recalc
            wallEntity.addTo(sceneContainer);
        });
        
        // Generate floor sprites and add to stage
        const floorContainer = new Container();
        floorContainer.zIndex = -1;
        
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
        
        // Add door
        const doorContainer = new Container();
        doorContainer.position.set(4 * tileSize, 1 * tileSize);
        
        const doorSprites = generateSpritesFromAtlasMap([
            ['doorTopLeft', 'doorTopRight'],
            ['doorBottomLeft', 'doorBottomRight']
        ]);
        
        doorSprites.forEach(doorSprite => doorContainer.addChild(doorSprite));
        
        const doorEntity = new SceneEntity({ item: doorContainer, bindZToY: true, zBindingMultiplier });
        doorEntity.addTo(sceneContainer);
        
        // Add actions (door open, etc.)
        const doorTiles = doorContainer.children as Sprite[];
        
        const actionOpenDoor = (collisionInfo: CollisionInfo) => {
            const collisionItems: (Container | InteractableEntity)[] = Object.values(collisionInfo.collisions).reduce((carry, collisionItemsOnSide) => {
                collisionItemsOnSide.forEach(item => carry.push(item));
                return carry;
            }, []);
            
            if (!collisionItems.includes(playerChar)) {
                // Reregister
                doorAction.addEventListener('collision', actionOpenDoor, { once: true });
                return;
            }
            
            console.log('opening door'); // DEBUG
            
            doorTiles.forEach(sprite => {
                // Swap out sprite with corresponding open door sprite
                const currentTextureFrameName: string = sprite.texture.textureCacheIds.filter(frameName => /^door/.test(frameName))[0] ?? '';
                const newTextureFrameName = `open${currentTextureFrameName.substr(0, 1).toUpperCase()}${currentTextureFrameName.substr(1)}`;
                sprite.texture = wallSheet[newTextureFrameName];
            });
        };
        
        const doorAction = new InteractableEntity();
        doorAction.x = doorEntity.x;
        doorAction.y = doorEntity.y + doorEntity.height;
        doorAction.width = tileSize * 2;
        doorAction.height = tileSize / 2;
        doorAction.addEventListener('collision', actionOpenDoor, {once: true});
        // createDebugOverlay(doorAction, sceneContainer, { visible: true, zIndex: 10 })
        actions.push(doorAction);
        
        // Add ladder
        const ladderSprite = new Sprite(wallSheet['floorLadder']);
        ladderSprite.position.set(2 * tileSize, 1 * tileSize);
        ladderSprite.zIndex = -1;
        
        const ladderObj = new InteractableEntity({ item: ladderSprite });
        ladderObj.setBoundingBox({ x: 4, y: 4, width: -8, height: -14 }, { mode: 'offset' });
        ladderObj.addTo(sceneContainer);
        
        // ** Characters
        const handleCharacterFacingDirection = (char: CharacterEntity, changedVectors: (keyof Velocity)[]) => {
            if (!changedVectors.includes('vx')) {
                return;
            }
            const charSprite = char.mirrorTarget;
            if (Math.abs(char.velocity.vx) > 0 && (charSprite?.scale.x ?? 0) !== Math.sign(char.velocity.vx)) {
                // Change character's direction
                char.mirrorX();
            }
        };
        
        // Add player character
        const playerContainer = new Container();
        playerContainer.zIndex = 11; // This goes above the wall, floor, and npc sprites
        
        const playerSprite = new Sprite(mainSheet['characterBeard']);
        playerSprite.anchor.set(0.5, 0.5);
        playerSprite.position.set(...calcCenter(null, playerSprite));
        playerContainer.position.set(...calcScaledPos(2, 6, tileSize));
        playerContainer.addChild(playerSprite);
        
        const playerChar = new CharacterEntity({ item: playerContainer, mirrorTarget: playerSprite, name: 'playerChar', bindZToY: true, zBindingMultiplier, zBindingOffset: -0.01 });
        playerChar.setBoundingBox({ x: 2, width: -3, height: -playerChar.height + charEntHitboxHeight, y: playerChar.height - charEntHitboxHeight }, {
            mode: 'offset',
            target: playerSprite,
            boundingBoxDebugOverlay: createDebugOverlay(playerContainer, sceneContainer, { zIndex: 12, visible: false })
        });
        playerChar.addTo(sceneContainer);
        playerChar.velocity.vx = 0;
        playerChar.velocity.vy = 0;
        playerChar.maxVelocity.vx = playerMaxVelocity;
        playerChar.maxVelocity.vy = playerMaxVelocity;
        playerChar.addEventListener('velocityChange', handleCharacterFacingDirection);
        
        // Add NPCs
        const npcContainer = new Container();
        
        const npcSprite = new Sprite(mainSheet['characterEyePatch']);
        npcSprite.anchor.set(0.5, 0.5);
        npcSprite.scale.x *= -1;
        npcSprite.position.set(...calcCenter(null, playerSprite));
        npcContainer.position.set(...calcScaledPos((mapSize.width - 7), 0, tileSize));
        npcContainer.addChild(npcSprite);
        // createDebugOverlay(npcContainer);
        
        const npcChar = new CharacterEntity({ item: npcContainer, mirrorTarget: npcSprite, name: 'npcChar', bindZToY: true, zBindingMultiplier, zBindingOffset: -0.01 });
        npcChar.setBoundingBox({ x: 3, width: -6, height: -npcChar.height + charEntHitboxHeight, y: npcChar.height - charEntHitboxHeight }, {mode: 'offset', target: npcSprite});
        npcChar.velocity.vx = -0.02;
        npcChar.addEventListener('collisionSceneBoundary', () => npcChar.velocity.vx *= -1);
        npcChar.addEventListener('velocityChange', handleCharacterFacingDirection);
        
        let npcWalkPauseTimeout: null | number = null;
        let npcPreCollisionVx: number = 0;
        
        npcChar.addEventListener('collision', (collisionInfo: CollisionInfo) => {
            const collisionItems: (Container | InteractableEntity)[] = Object.values(collisionInfo.collisions).reduce((carry, collisionItemsOnSide) => {
                collisionItemsOnSide.forEach(item => carry.push(item));
                return carry;
            }, []);
            if (!collisionItems.includes(playerChar)) {
                // Probably a wall; reverse!
                npcChar.velocity.vx *= -1;
                return;
            }
            const origVx = npcChar.velocity.vx;
            if (origVx !== 0 && npcPreCollisionVx === 0) {
                npcChar.velocity.vx = 0;
                npcPreCollisionVx = origVx;
            }
            if (npcWalkPauseTimeout !== null) {
                clearTimeout(npcWalkPauseTimeout);
            }
            npcWalkPauseTimeout = window.setTimeout(() => {
                npcChar.velocity.vx = npcPreCollisionVx;
                npcPreCollisionVx = 0;
                npcWalkPauseTimeout = null;
            }, 2000);
        });
        npcChar.addTo(sceneContainer);
        
        
        
        // Add torch
        const torchSprite = new Sprite(mainSheet['torchBottom0']);
        torchSprite.position.set(7 * tileSize, 3 * tileSize);
        
        const torchObj = new InteractableEntity({ item: torchSprite, bindZToY: true, zBindingMultiplier });
        torchObj.setBoundingBox({ x: 4, width: -8, height: -2 }, { mode: 'offset' });
        torchObj.addTo(sceneContainer);
        
        // Add fire
        const torchFireContainer = new Container();
        torchFireContainer.position.set(7.5 * tileSize, 3.1 * tileSize); // Position the particle origin nicely on the torch
        torchFireContainer.zIndex = torchSprite.zIndex + 1;
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
            walls: wallEntities,
            door: doorEntity,
            ladder: ladderObj,
            torch: {
                base: torchObj,
                fire: torchFireContainer,
                fireEmitter: torchFireEmitter,
            },
            actions,
        };
    }
    
    /** Returns an array of objects that can be collided with */
    getSolidObjects(): (DisplayObject | InteractableEntity)[] {
        return [
            // REVIEW: Consider genericizing this further, maybe with this property existing on the InteractableEntity
            ...this.items.walls,
            this.items.playerChar,
            this.items.npcChar,
            this.items.torch.base,
            this.items.ladder,
        ]
    }
    
    onTick(delta: number) {
        this.onTickCbArr.forEach(cb => cb(delta));
    }
    
}