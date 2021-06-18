import { Application, Loader, Text, TextStyle, settings, SCALE_MODES, Container, DisplayObject } from "pixi.js";
import { calcCenter, calcZFromGeometry } from "./utils";
import { InteractableEntity, Velocity, CollisionInfo } from "./InteractableEntity";
import { GameSceneBase, GameSceneIface } from "./GameScene";
import { MainScene } from "./scenes/MainScene";
import { KeyboardListener } from "./KeyboardListener";
import { hitTestRectangle, HIT_DOWN, HIT_LEFT, HIT_RIGHT, HIT_UP } from "./collisions";
import { Dimensions, SceneEntity } from "./SceneEntity";

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
            inventoryKey,
            minusKey, equalsKey, debugKey
        ] = [
            new KeyboardListener('ArrowUp'),
            new KeyboardListener('ArrowRight'),
            new KeyboardListener('ArrowDown'),
            new KeyboardListener('ArrowLeft'),
            new KeyboardListener('KeyW'),
            new KeyboardListener('KeyD'),
            new KeyboardListener('KeyS'),
            new KeyboardListener('KeyA'),
            new KeyboardListener('KeyE'),
            new KeyboardListener('Minus'),
            new KeyboardListener('Equal'),
            new KeyboardListener('KeyI'),
        ];
        
        const { playerMaxVelocity } = Game;
        
        const keyboardPlayerVelocity: Velocity = {vx: 0, vy: 0};
        
        const changeVelocityCircular = (axis: keyof Velocity, amount: number) => {
            keyboardPlayerVelocity[axis] += amount;
            playerChar.velocity.set(InteractableEntity.getSmoothVelocityCircular(keyboardPlayerVelocity));
        }
        
        arrowUp.press = wKey.press = () => changeVelocityCircular('vy', -playerMaxVelocity);
        arrowUp.release = wKey.release = () => changeVelocityCircular('vy', playerMaxVelocity);
        arrowDown.press = sKey.press = () => changeVelocityCircular('vy', playerMaxVelocity);
        arrowDown.release = sKey.release = () => changeVelocityCircular('vy', -playerMaxVelocity);
        
        arrowRight.press = dKey.press = () => changeVelocityCircular('vx', playerMaxVelocity);
        arrowRight.release = dKey.release = () => changeVelocityCircular('vx', -playerMaxVelocity);
        arrowLeft.press = aKey.press = () => changeVelocityCircular('vx', -playerMaxVelocity);
        arrowLeft.release = aKey.release = () => changeVelocityCircular('vx', playerMaxVelocity);
        
        inventoryKey.press = () => console.table(playerChar.inventory);
        
        minusKey.press = () => setZoom(this.worldScale - 0.5);
        equalsKey.press = () => setZoom(this.worldScale + 0.5);
        
        debugKey.press = () => console.log(playerChar.getDimensions());
        
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
        
        // const playerChar = currentScene.items.playerChar;
        const sceneItems = currentScene.getItemsFlat();
        
        // Move
        const movedItems = sceneItems.filter(item => item instanceof InteractableEntity && item.move(delta, tileSize));
        
        // Cap movement to playable area based on bounding box
        movedItems.forEach(item => {
            const boundingBox: Dimensions = (
                item instanceof InteractableEntity
                ? item.getBoundingBox()
                : item
            );
            const boundingBoxOffset: Dimensions = (
                item instanceof InteractableEntity
                ? item.calculateBoundingBoxOffsetFromOrigin(boundingBox)
                : {width: item.width, height: item.height, x: 0, y: 0}
            );
            
            const oldCoords = { x: item.x, y: item.y };
            const mapDims = { width: (mapSize.width * tileSize), height: (mapSize.height * tileSize) };
            
            item.x = Math.max(boundingBoxOffset.x, Math.min(item.x, mapDims.width - boundingBox.width + boundingBoxOffset.x));
            item.y = Math.max(boundingBoxOffset.y, Math.min(item.y, mapDims.height - boundingBox.height + boundingBoxOffset.y));
            
            if ((item.x !== oldCoords.x || item.y !== oldCoords.y) && item instanceof InteractableEntity) {
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
        const collisionCheckItems = [...movedItems, ...currentScene.items.actions].filter(Game.collisionCheckTypeGuard);
        const objectsToCheck: (DisplayObject | InteractableEntity<any>)[] = currentScene.getSolidObjects()
            .filter(ent => !(ent instanceof InteractableEntity) || ent.boundingBoxEnabled);
        const computedCollisionInfo: CollisionInfo[] = this.checkCollisions(collisionCheckItems, objectsToCheck);
        const collidedEntities = computedCollisionInfo.filter(collisionInfo => collisionInfo.occurred);
        
        // Dispatch collision events
        collidedEntities.forEach(collisionInfo => {
            const collisionCheckItem = collisionInfo.entity;
            const collisionItems: (Container | InteractableEntity<any>)[] = Object.values(collisionInfo.collisions).reduce((carry, collisionItemsOnSide) => {
                collisionItemsOnSide.forEach(item => carry.push(item));
                return carry;
            }, []);
            if (collisionCheckItem instanceof InteractableEntity /* && collisionItems.some(container => container instanceof InteractableEntity) */) {
                collisionCheckItem.dispatchCollisionEvent(collisionInfo);
            }
        });
        
        // Handle collisions
        this.handleCollisions(collidedEntities);
        
        // Update z-axis based on y positions
        movedItems
            .filter(item => (item instanceof Container) || item.bindZToY === false) // Filter out entities that already handle this
            .forEach(item => {
                const newZ = calcZFromGeometry(item, tileSize, true) + 0.5; // The magic 0.5 is here for sort-cache-busting related reasons
                if (newZ !== item.zIndex) {
                    item.zIndex = newZ;
                }
            });
        
        // Particles
        currentScene.onTick(delta);
        
    }
    
    pauseState: GameState = (delta: number) => {
        // Do nothing for now
    }
    
    /**
     * Check collisions across a list of items
     * @param collisionCheckItems An array of items to perform collision checks on
     * @param allObjectsToCheck An array of objects to check collisions from collisionCheckItems against
     * @returns An array of collision details. This will not always have the same index mapping to the source collisionCheckItems array.
     */
    checkCollisions(collisionCheckItems: (Container | InteractableEntity<any>)[], allObjectsToCheck: (InteractableEntity<any> | DisplayObject)[]): CollisionInfo[] {
        let collisionDict = collisionCheckItems.map(collisionCheckItem => this.checkCollision(collisionCheckItem, allObjectsToCheck));
        
        const unmovedCollisionCheckItems: (Container | InteractableEntity<any>)[] = [];
        
        collisionDict.forEach((collisionInfo, i) => {
            if (!collisionInfo.occurred) {
                return;
            }
            const collisionCheckItem = collisionCheckItems[i];
            // Go through all detected collisions to determine if the items they collided with also need to have collisions computed (the inverse)
            Object.values(collisionInfo.collisions).forEach((objs) => objs.forEach(container => {
                if (collisionCheckItem instanceof InteractableEntity && container instanceof InteractableEntity) {
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
            // Compute inverse collisions (for entities that were *collided with* but not otherwise checked for collision) and add to the collision detection array
            collisionDict = [
                ...collisionDict,
                ...unmovedCollisionCheckItems.map(unmovedCollisionCheckItem => this.checkCollision(unmovedCollisionCheckItem, allObjectsToCheck))
            ];
        }
        
        return collisionDict;
    }
    
    /**
     * Checks for collisions between an item and a list of objects
     * @param collisionCheckItem The item to check collisions from
     * @param allObjectsToCheck A list of items to check if the collisionCheckItem collided with
     * @returns Collision check results
     */
    checkCollision(collisionCheckItem: Container | InteractableEntity<any>, allObjectsToCheck: (InteractableEntity<any> | DisplayObject)[]): CollisionInfo {
        
        const collisionInfo: CollisionInfo = {
            entity: collisionCheckItem,
            occurred: false,
            sideOfEntityBit: 0b0,
            collisions: {},
        };
        
        const objectsToCheck = allObjectsToCheck.filter(item => item !== collisionCheckItem);
        
        let sourceBoundingBox = 'getBoundingBox' in collisionCheckItem ? collisionCheckItem.getBoundingBox() : collisionCheckItem;
        
        // Solid collisions
        for (const i in objectsToCheck) {
            const container = objectsToCheck[i] as Container | InteractableEntity<any>;
            const targetBoundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
            if ('visible' in container ? !container.visible : container.item?.visible === false) {
                continue;
            }
            const [isCollision, sideOfEntityBit] = hitTestRectangle(sourceBoundingBox, targetBoundingBox);
            if (isCollision) {
                collisionInfo.occurred = true;
                collisionInfo.sideOfEntityBit |= sideOfEntityBit;
                
                // NOTE: At the time of authoring there *shouldn't* be a time when sideOfEntityBit gets returned with
                //       multiple bits set. Multiple bits are, however, expected in collisionInfo.sideOfEntityBit. This
                //       logic is being left this way to handle a single collision on multiple sides if that
                //       functionality is adjusted in the future.
                if (sideOfEntityBit & HIT_UP) {
                    collisionInfo.collisions[HIT_UP] = collisionInfo.collisions[HIT_UP] ?? [];
                    collisionInfo.collisions[HIT_UP].push('item' in container ? container : container);
                }
                if (sideOfEntityBit & HIT_DOWN) {
                    collisionInfo.collisions[HIT_DOWN] = collisionInfo.collisions[HIT_DOWN] ?? [];
                    collisionInfo.collisions[HIT_DOWN].push('item' in container ? container : container);
                }
                if (sideOfEntityBit & HIT_LEFT) {
                    collisionInfo.collisions[HIT_LEFT] = collisionInfo.collisions[HIT_LEFT] ?? [];
                    collisionInfo.collisions[HIT_LEFT].push('item' in container ? container : container);
                }
                if (sideOfEntityBit & HIT_RIGHT) {
                    collisionInfo.collisions[HIT_RIGHT] = collisionInfo.collisions[HIT_RIGHT] ?? [];
                    collisionInfo.collisions[HIT_RIGHT].push('item' in container ? container : container);
                }
                
                // if (collisionCheckItem.name === 'playerChar') {
                //     console.debug(`${sideOfEntityBit & HIT_LEFT ? '+' : '.'}L ${sideOfEntityBit & HIT_RIGHT ? '+' : '.'}R ${sideOfEntityBit & HIT_UP ? '+' : '.'}U ${sideOfEntityBit & HIT_DOWN ? '+' : '.'}D :: ${container.ident ?? container.name}`);
                // }
            }
        }
        
        return collisionInfo;
    }
    
    handleCollisions(collidedEntities: CollisionInfo[]) {
        collidedEntities.forEach(collisionInfo => this.handleCollision(collisionInfo));
    }
    
    handleCollision(collisionInfo: CollisionInfo) {
        // REVIEW: This can most likely be cleaned up. This took a lot of trial-and-error to get right.
        
        const entity = collisionInfo.entity;
        
        if (entity instanceof Container) {
            console.info(`Collision not handled on entity '${entity.name}' because it is not an InteractableEntity`)
            return;
        }
        
        if (Math.abs(entity.velocity.vx) + Math.abs(entity.velocity.vy) === 0) {
            // This was not the entity that caused the collision but rather the recipient of the collision; do not revert
            return;
        }
        
        const collidingObjects = collisionInfo.collisions;
        let entityBoundingBox = entity.getBoundingBox();
        let entityBoundingBoxOffset = entity.calculateBoundingBoxOffsetFromOrigin(entityBoundingBox);
        
        const preRollbackPos = { x: entity.x, y: entity.y };
        
        // Reverse entity's position so it no longer intersects with the object it is colliding with
        let recalculateEntityBoundingBox = false;
        
        if (collisionInfo.sideOfEntityBit & HIT_LEFT) {
            recalculateEntityBoundingBox = true;
            entity.x = Math.max(Math.max(...collidingObjects[HIT_LEFT].map(container => {
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                return boundingBox.x + boundingBox.width;
            })), entity.x) + entityBoundingBoxOffset.x;
        }
        
        if (collisionInfo.sideOfEntityBit & HIT_UP) {
            recalculateEntityBoundingBox = true;
            entity.y = Math.max(Math.max(...collidingObjects[HIT_UP].map(container => {
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                return boundingBox.y + boundingBox.height;
            })), entity.y) + entityBoundingBoxOffset.y;
        }
        
        if (recalculateEntityBoundingBox) {
            // Recalculate entity's bounding box before we move onto the other side of the x and y coords
            entityBoundingBox = entity.getBoundingBox();
            entityBoundingBoxOffset = entity.calculateBoundingBoxOffsetFromOrigin(entityBoundingBox);
            recalculateEntityBoundingBox = false;
        }
        
        if (collisionInfo.sideOfEntityBit & HIT_RIGHT) {
            recalculateEntityBoundingBox = true;
            entity.x = Math.min(Math.min(...collidingObjects[HIT_RIGHT].map(container => {
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                return boundingBox.x; // - boundingBoxOffset.x;
            })), entity.x + entityBoundingBox.width - entityBoundingBoxOffset.x) - entityBoundingBox.width + entityBoundingBoxOffset.x;
        }
        
        if (collisionInfo.sideOfEntityBit & HIT_DOWN) {
            recalculateEntityBoundingBox = true;
            entity.y = Math.min(Math.min(...collidingObjects[HIT_DOWN].map(container => {
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                // const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                return boundingBox.y; // - boundingBoxOffset.y;
            })), entity.y + entityBoundingBox.height - entityBoundingBoxOffset.y) - entityBoundingBox.height + entityBoundingBoxOffset.y;
        }
        
        if (recalculateEntityBoundingBox) {
            // Recalculate entity's bounding box before we move onto granular movement
            entityBoundingBox = entity.getBoundingBox();
            entityBoundingBoxOffset = entity.calculateBoundingBoxOffsetFromOrigin(entityBoundingBox);
            recalculateEntityBoundingBox = false;
        }
        
        /** Explanation of the following:
         * Try to prevent multi-axis movements from getting hung up on edges of tiles that it should not get hung up
         * on. Eg. when pressing up+right and running into a straight vertical wall. Without this logic the entity's
         * x and y velocity would both be cancelled if the entity was roughly in the middle of a tile (causing a
         * collision to also occur on the tile immediately to the right of the primarily colliding tile). The goal
         * of this is to incrementally try to move the entity's position on one axis and then check the previously
         * detected collisions and see if they are still colliding. If they are, we cannot move in that axis. If not,
         * we can move on that axis.
         */
        
        // Granular X-axis
        {
            const nonCollidingPosX = entity.x;
            entity.x = preRollbackPos.x;
            const updatedEntityBoundingBox = entity.getBoundingBox();
            const recheckCollisionsX = [...(collidingObjects[HIT_LEFT] ?? []), ...(collidingObjects[HIT_RIGHT] ?? [])];
            const isStillCollisionX = recheckCollisionsX.reduce((carry, container) => {
                if (carry) { return carry; }
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                return hitTestRectangle(updatedEntityBoundingBox, boundingBox)[0];
            }, false);
            if (isStillCollisionX) {
                // Revert
                entity.x = nonCollidingPosX;
            }
        }
        
        // Granular Y-axis
        {
            const nonCollidingPosY = entity.y;
            entity.y = preRollbackPos.y;
            const updatedEntityBoundingBox = entity.getBoundingBox();
            const recheckCollisionsY = [...(collidingObjects[HIT_UP] ?? []), ...(collidingObjects[HIT_DOWN] ?? [])];
            const isStillCollisionY = recheckCollisionsY.reduce((carry, container) => {
                if (carry) { return carry; }
                const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                return hitTestRectangle(updatedEntityBoundingBox, boundingBox)[0];
            }, false);
            if (isStillCollisionY) {
                // Revert
                entity.y = nonCollidingPosY;
            }
        }
        
    }
    
    static collisionCheckTypeGuard = (item: InteractableEntity<any> | SceneEntity<any> | Container): item is (InteractableEntity<any> | Container) => (item instanceof InteractableEntity || item instanceof Container);
    
}
