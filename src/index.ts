import { Game } from './Game';

import { Application, Loader, utils, Sprite, Rectangle, Text, TextStyle, Texture, Resource, settings, SCALE_MODES, Container } from "pixi.js";
import * as particles from 'pixi-particles';
import { torch } from './particles/fire';

import { HIT_DOWN, HIT_LEFT, HIT_RIGHT, HIT_UP, hitTestRectangle, HitRectangle } from './collisions';
import { calcCenter, calcScaledPos, createDebugOverlay, randomTrue, tau } from './utils';
import { KeyboardListener } from './KeyboardListener';
import { CharacterObject } from './CharacterObject';
import { InteractableObject } from './InteractableObject';

const game = new Game(window.devicePixelRatio, {width: window.innerWidth, height: window.innerHeight});

game.app.renderer.view.style.position = "absolute";
game.app.renderer.view.style.display = "block";

// Add the canvas that Pixi automatically created for you to the HTML document
document.body.appendChild(game.app.view);

// TEMP for refactoring
const loader = Loader.shared; // or create a dedicated one with `new Loader()`
const resources = loader.resources;
const { displayScalingOffset, worldScale, app } = game;
const { spriteSheetTextureAtlasFiles } = Game;

const setup = () => {
    // Create scene that contains all of the objects we want to render. This greatly simplifies scaling, positioning, and handling device pixel ratio.
    const sceneContainer = new Container();
    sceneContainer.scale.set(displayScalingOffset * worldScale);
    sceneContainer.sortableChildren = true;
    
    const wallSheet = resources[spriteSheetTextureAtlasFiles.walls]?.textures ?? {};
    const mainSheet = resources[spriteSheetTextureAtlasFiles.main]?.textures ?? {};
    
    const tileSize = 16;
    
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
    
    const mapSize = {width: 10, height: 10};
    
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
    
    const actionMap: ( () => void )[][] = Array(mapSize.height)
        .fill(null);
    
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
    const actionOpenDoor = () => {
        if (doorOpen) { return; }
        [...wallUpperSprites, ...wallLowerSprites]
            .filter(sprite => sprite.texture.textureCacheIds.some(frameName => /^door/.test(frameName)))
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
    
    actionMap[3] = Array(mapSize.width);
    actionMap[3][4] = actionMap[3][5] = () => actionOpenDoor();
    
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
    
    const playerChar = new CharacterObject({ item: playerContainer });
    playerChar.setBoundingBox({x: 2, width: -3}, {mode: 'offset', target: playerSprite, boundingBoxDebugOverlay: playerBoundingBoxDebugOverlay});
    playerChar.addTo(sceneContainer);
    playerChar.velocity.vx = 0;
    playerChar.velocity.vy = 0;
    
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
    sceneContainer.addChild(torchSprite);
    
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
    
    // TEMP: Collision detection text
    const collisionTextStyle = new TextStyle({ fill: 'white', fontSize: 72 * displayScalingOffset, align: 'right' });
    const collisionText = new Text('OK', collisionTextStyle);
    collisionText.zIndex = 99; // Text goes on top of everything
    collisionText.visible = false;
    app.stage.addChild(collisionText);
    app.stage.sortableChildren = true; // TEMP
    
    // Add scene to main app stage
    app.stage.addChild(sceneContainer);
    
    // Render this initial stage
    app.renderer.render(app.stage);
    
    // Define game loop states
    type GameState = (delta: number) => void;
    
    const playState: GameState = (delta: number) => {
        
        // Move
        playerChar.x += Math.max(Math.min(playerChar.velocity.vx, playerMaxVelocity), -playerMaxVelocity) * tileSize * delta;
        playerChar.y += Math.max(Math.min(playerChar.velocity.vy, playerMaxVelocity), -playerMaxVelocity) * tileSize * delta;
        
        let playerBoundingBox = playerChar.getBoundingBox();
        let playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
        
        // Cap movement to playable area
        playerChar.x = Math.max(playerBoundingBoxOffset.x, Math.min(playerChar.x, (mapSize.width * tileSize) - playerBoundingBox.width + playerBoundingBoxOffset.x));
        playerChar.y = Math.max(playerBoundingBoxOffset.y, Math.min(playerChar.y, (mapSize.height * tileSize) - playerBoundingBox.height + playerBoundingBoxOffset.y));
        
        // Check collisions
        let playerCollisionInfo: { occurred: boolean, sideOfPlayerBit: number } = {
            occurred: false,
            sideOfPlayerBit: 0b0,
        };
        
        const collidingObjects: { [directionBit: number]: (Container | InteractableObject)[] } = [];
        const objectsToCheck = [...wallLowerContainer.children, npcChar];
        
        playerBoundingBox = playerChar.getBoundingBox();
        playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
        
        // Solid collisions
        for (const i in objectsToCheck) {
            const container = objectsToCheck[i] as Container | InteractableObject;
            const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
            if ('visible' in container && !container.visible) {
                continue;
            }
            const [isCollision, sideOfPlayerBit] = hitTestRectangle(playerBoundingBox, boundingBox);
            if (isCollision) {
                playerCollisionInfo.occurred = true;
                playerCollisionInfo.sideOfPlayerBit |= sideOfPlayerBit;
                collidingObjects[sideOfPlayerBit] = collidingObjects[sideOfPlayerBit] ?? [];
                collidingObjects[sideOfPlayerBit].push('item' in container ? container : container);
                // break;
            }
        }
        collisionText.text = (playerCollisionInfo.occurred ? 'Collision' : 'OK');
        
        // Action collisions
        actionMap.forEach((actionRow, r) => {
            (actionRow ?? []).forEach((actionFunc, c) => {
                const container: HitRectangle = {
                    x: c * tileSize,
                    y: r * tileSize,
                    width: tileSize,
                    height: tileSize,
                };
                const [isCollision] = hitTestRectangle(playerBoundingBox, container);
                if (isCollision) {
                    actionFunc();
                }
            });
        });
        
        if (playerCollisionInfo.occurred) {
            // REVIEW: This can most likely be cleaned up. This took a lot of trial-and-error to get right.
            
            const preRollbackPos = { x: playerChar.x, y: playerChar.y };
            
            // Reverse player's position so it no longer intersects with the object it is colliding with
            let recalculatePlayerBoundingBox = false;
            
            if (playerChar.velocity.vx < 0 && playerCollisionInfo.sideOfPlayerBit & HIT_LEFT) {
                recalculatePlayerBoundingBox = true;
                playerChar.x = Math.max(Math.max(...collidingObjects[HIT_LEFT].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.x + boundingBox.width;
                })), playerChar.x) + playerBoundingBoxOffset.x;
            }
            
            if (playerChar.velocity.vy < 0 && playerCollisionInfo.sideOfPlayerBit & HIT_UP) {
                recalculatePlayerBoundingBox = true;
                playerChar.y = Math.max(Math.max(...collidingObjects[HIT_UP].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.y + boundingBox.height;
                })), playerChar.y) + playerBoundingBoxOffset.y;
            }
            
            if (recalculatePlayerBoundingBox) {
                // Recalculate player's bounding box before we move onto the other side of the x and y coords
                playerBoundingBox = playerChar.getBoundingBox();
                playerBoundingBoxOffset = playerChar.calculateBoundingBoxOffsetFromOrigin(playerBoundingBox);
                recalculatePlayerBoundingBox = false;
            }
            
            if (playerChar.velocity.vx > 0 && playerCollisionInfo.sideOfPlayerBit & HIT_RIGHT) {
                recalculatePlayerBoundingBox = true;
                playerChar.x = Math.min(Math.min(...collidingObjects[HIT_RIGHT].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
                    return boundingBox.x; // - boundingBoxOffset.x;
                })), playerChar.x + playerBoundingBox.width - playerBoundingBoxOffset.x) - playerBoundingBox.width + playerBoundingBoxOffset.x;
            }
            
            if (playerChar.velocity.vy > 0 && playerCollisionInfo.sideOfPlayerBit & HIT_DOWN) {
                recalculatePlayerBoundingBox = true;
                playerChar.y = Math.min(Math.min(...collidingObjects[HIT_DOWN].map(container => {
                    const boundingBox = 'getBoundingBox' in container ? container.getBoundingBox() : container;
                    const boundingBoxOffset = InteractableObject.calculateBoundingBoxOffset(boundingBox, container);
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
        updateParticleOnTick(delta);
        
    };
    
    const pauseState: GameState = (delta: number) => {
        // Do nothing for now
    };
    
    let state: GameState = playState;
    
    // Event listeners
    const setZoom = (level: number) => {
        game.worldScale = level;
        sceneContainer.scale.set(displayScalingOffset * worldScale);
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
        new KeyboardListener('w'),
        new KeyboardListener('d'),
        new KeyboardListener('s'),
        new KeyboardListener('a'),
        new KeyboardListener('-'),
        new KeyboardListener('='),
    ];
    
    // TODO: Improve this velocity logic to distribute speed based on relative circle position
    // TODO: Fix bug allowing player to go twice the speed if pressing up arrow and 'w' key
    const playerMaxVelocity = 3/60; // expressed in tiles per second
    
    arrowUp.press = wKey.press = () => playerChar.velocity.vy -= playerMaxVelocity;
    arrowUp.release = wKey.release = () => playerChar.velocity.vy -= -playerMaxVelocity;
    arrowDown.press = sKey.press = () => playerChar.velocity.vy += playerMaxVelocity;
    arrowDown.release = sKey.release = () => playerChar.velocity.vy += -playerMaxVelocity;
    
    arrowRight.press = dKey.press = () => {
        playerChar.velocity.vx += playerMaxVelocity;
        playerSprite.scale.x *= (playerSprite.scale.x < 0 ? -1 : 1); // Look right
    };
    arrowRight.release = dKey.release = () => playerChar.velocity.vx += -playerMaxVelocity;
    arrowLeft.press = aKey.press = () => {
        playerChar.velocity.vx -= playerMaxVelocity;
        playerSprite.scale.x *= (playerSprite.scale.x > 0 ? -1 : 1); // Look left
    };
    arrowLeft.release = aKey.release = () => playerChar.velocity.vx -= -playerMaxVelocity;
    
    minusKey.press = () => setZoom(worldScale - 0.5);
    equalsKey.press = () => setZoom(worldScale + 0.5);
    
    // Define and start the game loop
    const gameLoop = (delta: number) => state(delta);
    app.ticker.add(delta => gameLoop(delta));
}

game.load(setup);
