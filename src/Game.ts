import { Application, Loader, Text, TextStyle, settings, SCALE_MODES, Container, DisplayObject } from "pixi.js";
import { calcCenter } from "./utils";
import { InteractableObject, Velocity, CollisionInfo } from "./InteractableObject";
import { GameSceneBase, GameSceneIface } from "./GameScene";
import { MainScene } from "./scenes/MainScene";
import { KeyboardListener } from "./KeyboardListener";
import { HitRectangle, hitTestRectangle, HIT_DOWN, HIT_LEFT, HIT_RIGHT, HIT_UP } from "./collisions";
import { Dimensions } from "./SceneObject";

// TODO: Move these to this.loader
const loader = Loader.shared; // or create a dedicated one with `new Loader()`
const resources = loader.resources;

type GameState = (delta: number) => void;

export class Game {
    
    app: Application;
    currentScene: null | (GameSceneBase & GameSceneIface<unknown>) = null;
    state: GameState = this.initState;
    
    static playerMaxVelocity = 3 / 60; // Expressed in tiles per second
    static tileSize = 16;
    
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
    
    setup = () => {
        
        const mainScene = new MainScene(this, resources);
        
        // Add scene to main app stage
        this.currentScene = mainScene.addToGame(this.app.stage);
        
        // Render this initial stage
        this.app.renderer.render(this.app.stage);
        
        this.setupKeybindings();
        
        // Default state to play state
        this.state = this.playState;
        
        // Define and start the game loop
        const gameLoop = (delta: number) => this.state(delta);
        this.app.ticker.add(delta => gameLoop(delta));
        
    }
    
    setupKeybindings() {
        
        const { currentScene, displayScalingOffset } = this;
        const sceneContainer = currentScene?.sceneContainer;
        const playerChar = (currentScene as MainScene).items.playerChar; // TODO: Type safe
        
        // Event listeners
        const setZoom = (level: number) => {
            this.worldScale = level;
            sceneContainer && sceneContainer.scale.set(displayScalingOffset * level);
        };
        
        // Set keybindings
        const [
            arrowUp, arrowRight, arrowDown, arrowLeft,
            wKey, dKey, sKey, aKey,
            minusKey, equalsKey
        ] = [
            new KeyboardListener('ArrowUp'),
            new KeyboardListener('ArrowRight'),
            new KeyboardListener('ArrowDown'),
            new KeyboardListener('ArrowLeft'),
            new KeyboardListener('KeyW'),
            new KeyboardListener('KeyD'),
            new KeyboardListener('KeyS'),
            new KeyboardListener('KeyA'),
            new KeyboardListener('Minus'),
            new KeyboardListener('Equal'),
        ];
        
        const { playerMaxVelocity } = Game;
        
        const keyboardPlayerVelocity: Velocity = {vx: 0, vy: 0};
        
        const changeVelocityCircular = (axis: keyof Velocity, amount: number) => {
            keyboardPlayerVelocity[axis] += amount;
            playerChar.velocity.set(InteractableObject.getSmoothVelocityCircular(keyboardPlayerVelocity));
        }
        
        arrowUp.press = wKey.press = () => changeVelocityCircular('vy', -playerMaxVelocity);
        arrowUp.release = wKey.release = () => changeVelocityCircular('vy', playerMaxVelocity);
        arrowDown.press = sKey.press = () => changeVelocityCircular('vy', playerMaxVelocity);
        arrowDown.release = sKey.release = () => changeVelocityCircular('vy', -playerMaxVelocity);
        
        arrowRight.press = dKey.press = () => changeVelocityCircular('vx', playerMaxVelocity);
        arrowRight.release = dKey.release = () => changeVelocityCircular('vx', -playerMaxVelocity);
        arrowLeft.press = aKey.press = () => changeVelocityCircular('vx', -playerMaxVelocity);
        arrowLeft.release = aKey.release = () => changeVelocityCircular('vx', playerMaxVelocity);
        
        minusKey.press = () => setZoom(this.worldScale - 0.5);
        equalsKey.press = () => setZoom(this.worldScale + 0.5);
        
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
        
        loader.onProgress.add((loader: Loader) => updateLoadingText(loader.progress));
        loader.onComplete.once(() => loadingText.visible = false);
        
    }
    
    // States
    initState() {
        // I don't know if this needs to do anything other than occupy the spot while load and setup are happening
    }
    
    playState: GameState = (delta: number) => {
        
        const currentScene = this.currentScene as null | MainScene;
        const CurrentScene = MainScene; // TODO: Make this better
        const { mapSize } = CurrentScene;
        const { tileSize } = Game;
        
        if (currentScene === null) {
            return;
        }
        
        const playerChar = currentScene.items.playerChar;
        const sceneItems = currentScene.getItemsFlat();
        
        // Move
        const movedItems = sceneItems.filter(item => item instanceof InteractableObject && item.move(delta, tileSize));
        
        // Cap movement to playable area based on bounding box
        movedItems.forEach(item => {
            const boundingBox: Dimensions = (
                item instanceof InteractableObject
                ? item.getBoundingBox()
                : item
            );
            const boundingBoxOffset: Dimensions = (
                item instanceof InteractableObject
                ? item.calculateBoundingBoxOffsetFromOrigin(boundingBox)
                : {width: item.width, height: item.height, x: 0, y: 0}
            );
            
            const oldCoords = { x: item.x, y: item.y };
            const mapDims = { width: (mapSize.width * tileSize), height: (mapSize.height * tileSize) };
            
            item.x = Math.max(boundingBoxOffset.x, Math.min(item.x, mapDims.width - boundingBox.width + boundingBoxOffset.x));
            item.y = Math.max(boundingBoxOffset.y, Math.min(item.y, mapDims.height - boundingBox.height + boundingBoxOffset.y));
            
            if ((item.x !== oldCoords.x || item.y !== oldCoords.y) && item instanceof InteractableObject) {
                // Trigger special collision event
                item.dispatchEvent('collisionSceneBoundary', {
                    x: boundingBoxOffset.x,
                    y: boundingBoxOffset.y,
                    width: mapDims.width,
                    height: mapDims.height,
                });
            }
        });
        
        // Check collisions
        const collisionCheckItems = [...movedItems, ...currentScene.items.actions];
        const objectsToCheck: (DisplayObject | InteractableObject)[] = [
            // TODO: Genericize this
            ...currentScene.items.walls[0].children,
            currentScene.items.playerChar,
            currentScene.items.npcChar,
            currentScene.items.torch.base,
        ];
        const collisionInfoDict: CollisionInfo[] = this.checkCollisions(collisionCheckItems, objectsToCheck);
        
        const playerCheckItemIndex = collisionCheckItems.findIndex(item => item === playerChar);
        const playerCollisionInfo = collisionInfoDict[playerCheckItemIndex] ?? null;
        
        // Handle collisions
        if (playerCollisionInfo && playerCollisionInfo.occurred) {
            // REVIEW: This can most likely be cleaned up. This took a lot of trial-and-error to get right.
            // REVIEW: I'm using >= and <= for the initial velocity comparisons. This "fixes" one issue but may cause subtle bugs elsewhere.
            
            const collidingObjects = playerCollisionInfo.collisions;
            let playerBoundingBox = playerChar.getBoundingBox();
            let playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
            
            const preRollbackPos = { x: playerChar.x, y: playerChar.y };
            
            // Reverse player's position so it no longer intersects with the object it is colliding with
            let recalculatePlayerBoundingBox = false;
            
            if (playerChar.velocity.vx <= 0 && playerCollisionInfo.sideOfEntityBit & HIT_LEFT) {
                recalculatePlayerBoundingBox = true;
                playerChar.x = Math.max(Math.max(...collidingObjects[HIT_LEFT].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.x + boundingBox.width;
                })), playerChar.x) + playerBoundingBoxOffset.x;
            }
            
            if (playerChar.velocity.vy <= 0 && playerCollisionInfo.sideOfEntityBit & HIT_UP) {
                recalculatePlayerBoundingBox = true;
                playerChar.y = Math.max(Math.max(...collidingObjects[HIT_UP].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.y + boundingBox.height;
                })), playerChar.y) + playerBoundingBoxOffset.y;
            }
            
            if (recalculatePlayerBoundingBox) {
                // Recalculate player's bounding box before we move onto the other side of the x and y coords
                playerBoundingBox = playerChar.getBoundingBox();
                playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
                recalculatePlayerBoundingBox = false;
            }
            
            if (playerChar.velocity.vx >= 0 && playerCollisionInfo.sideOfEntityBit & HIT_RIGHT) {
                recalculatePlayerBoundingBox = true;
                playerChar.x = Math.min(Math.min(...collidingObjects[HIT_RIGHT].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.x; // - boundingBoxOffset.x;
                })), playerChar.x + playerBoundingBox.width - playerBoundingBoxOffset.x) - playerBoundingBox.width + playerBoundingBoxOffset.x;
            }
            
            if (playerChar.velocity.vy >= 0 && playerCollisionInfo.sideOfEntityBit & HIT_DOWN) {
                recalculatePlayerBoundingBox = true;
                playerChar.y = Math.min(Math.min(...collidingObjects[HIT_DOWN].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.y; // - boundingBoxOffset.y;
                })), playerChar.y + playerBoundingBox.height - playerBoundingBoxOffset.y) - playerBoundingBox.height + playerBoundingBoxOffset.y;
            }
            
            if (recalculatePlayerBoundingBox) {
                // Recalculate player's bounding box before we move onto granular movement
                playerBoundingBox = playerChar.getBoundingBox();
                playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
                recalculatePlayerBoundingBox = false;
            }
            
            /** Explanation of the following:
             * Try to prevent multi-axis movements from getting hung up on edges of tiles that it should not get hung up
             * on. Eg. when pressing up+right and running into a straight vertical wall. Without this logic the player's
             * x and y velocity would both be cancelled if the player was roughly in the middle of a tile (causing a
             * collision to also occur on the tile immediately to the right of the primarily colliding tile). The goal
             * of this is to incrementally try to move the player's position on one axis and then check the previously
             * detected collisions and see if they are still colliding. If they are, we cannot move in that axis. If not,
             * we can move on that axis.
             */
            
            // Granular X-axis
            {
                const nonCollidingPosX = playerChar.x;
                playerChar.x = preRollbackPos.x;
                const updatedPlayerBoundingBox = playerChar.getBoundingBox();
                const recheckCollisionsX = [...(collidingObjects[HIT_LEFT] ?? []), ...(collidingObjects[HIT_RIGHT] ?? [])];
                const isStillCollisionX = recheckCollisionsX.reduce((carry, container) => {
                    if (carry) { return carry; }
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    return hitTestRectangle(updatedPlayerBoundingBox, boundingBox)[0];
                }, false);
                if (isStillCollisionX) {
                    // Revert
                    playerChar.x = nonCollidingPosX;
                }
            }
            
            // Granular Y-axis
            {
                const nonCollidingPosY = playerChar.y;
                playerChar.y = preRollbackPos.y;
                const updatedPlayerBoundingBox = playerChar.getBoundingBox();
                const recheckCollisionsY = [...(collidingObjects[HIT_UP] ?? []), ...(collidingObjects[HIT_DOWN] ?? [])];
                const isStillCollisionY = recheckCollisionsY.reduce((carry, container) => {
                    if (carry) { return carry; }
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    return hitTestRectangle(updatedPlayerBoundingBox, boundingBox)[0];
                }, false);
                if (isStillCollisionY) {
                    // Revert
                    playerChar.y = nonCollidingPosY;
                }
            }
            
        }
        
        // Particles
        currentScene.onTick(delta);
        
    }
    
    pauseState: GameState = (delta: number) => {
        // Do nothing for now
    }
    
    checkCollisions(collisionCheckItems: (Container | InteractableObject)[], allObjectsToCheck: (InteractableObject | DisplayObject)[]): CollisionInfo[] {
        let collisionDict = collisionCheckItems.map(collisionCheckItem => this.checkCollision(collisionCheckItem, allObjectsToCheck));
        
        const unmovedCollisionCheckItems: (Container | InteractableObject)[] = [];
        
        collisionDict.forEach((collisionInfo, i) => {
            if (!collisionInfo.occurred) {
                return;
            }
            const collisionCheckItem = collisionCheckItems[i];
            // Go through all detected collisions to determine if the items they collided with also need to have collisions computed (the inverse)
            Object.values(collisionInfo.collisions).forEach((objs) => objs.forEach(container => {
                if (collisionCheckItem instanceof InteractableObject && container instanceof InteractableObject) {
                    // Only add this if it wouldn't otherwise have been part of the collisionCheckItems
                    if (!collisionCheckItems.includes(container)) {
                        // Only add this once to the recheck array (in case multiple objects collided with it)
                        if (!unmovedCollisionCheckItems.includes(container)) {
                            unmovedCollisionCheckItems.push(container);
                        }
                    }
                }
            }))
        });
        
        if (unmovedCollisionCheckItems.length > 0) {
            // TODO: Merge this with the results. This will also require tweaking the contents of CollisionInfo so this doens't need to purely be treated as a dict
            unmovedCollisionCheckItems.map(unmovedCollisionCheckItem => this.checkCollision(unmovedCollisionCheckItem, allObjectsToCheck));
        }
        
        return collisionDict;
    }
    
    checkCollision(collisionCheckItem: (Container | InteractableObject), allObjectsToCheck: (InteractableObject | DisplayObject)[]): CollisionInfo {
        
        const collisionInfo: CollisionInfo = {
            occurred: false,
            sideOfEntityBit: 0b0,
            collisions: {},
        };
        
        const objectsToCheck = allObjectsToCheck.filter(item => item !== collisionCheckItem);
        
        let sourceBoundingBox = 'getBoundingBox' in collisionCheckItem ? collisionCheckItem.getBoundingBox() : collisionCheckItem;
        
        // Solid collisions
        for (const i in objectsToCheck) {
            const container = objectsToCheck[i] as Container | InteractableObject;
            const targetBoundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
            if ('visible' in container ? !container.visible : container.item?.visible === false) {
                continue;
            }
            const [isCollision, sideOfEntityBit] = hitTestRectangle(sourceBoundingBox, targetBoundingBox);
            if (isCollision) {
                collisionInfo.occurred = true;
                collisionInfo.sideOfEntityBit |= sideOfEntityBit;
                collisionInfo.collisions[sideOfEntityBit] = collisionInfo.collisions[sideOfEntityBit] ?? [];
                collisionInfo.collisions[sideOfEntityBit].push('item' in container ? container : container);
                
                // TODO: Move this outside of here; probably to play state. Also trigger dispatchCollisionEvent with the entirety of the collisionObject
                if (collisionCheckItem instanceof InteractableObject && container instanceof InteractableObject) {
                    collisionCheckItem.dispatchCollisionEvent([container], collisionInfo);
                }
            }
        }
        
        return collisionInfo;
    }
    
}
