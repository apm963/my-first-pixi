import { Loader, Resource, Sprite, Texture } from "pixi.js";
import { Container } from "@pixi/display";
import * as particles from 'pixi-particles';

import { CharacterEntity } from "../CharacterEntity";
import { Game } from "../Game";
import { GameSceneBase, UiSceneIface } from "../GameScene";
import { torch } from '../particles/fire';
import { calcCenter, calcScaledPos, calcZFromGeometry, createDebugOverlay, randomTrue, tau } from "../utils";
import { CollisionInfo, InteractableEntity, SetBoundingBoxOpts, Velocity } from "../InteractableEntity";
import { PartialDimensions, SceneEntity } from "../SceneEntity";
import { getCollisionsFlat, HIT_LEFT, HIT_RIGHT } from "../collisions";
import { Inventory } from "../Inventory";

type SceneObjects = {
    playerInventorySlots: InteractableEntity<Container>[];
};

export class UiHudScene extends GameSceneBase implements UiSceneIface<SceneObjects> {
    
    items: SceneObjects;
    
    // static mapSize = { width: 10, height: 10 };
    
    constructor(
        public game: Game,
        public resources: Loader['resources']
    ) {
        super();
        
        this.items = this.generateObjects();
        
    }
    
    getItemsFlat(): (Container | InteractableEntity<any> | SceneEntity<any>)[] {
        return [
            ...this.items.playerInventorySlots,
        ];
    }
    
    generateObjects(): SceneObjects {
        
        const { game, resources, sceneContainer } = this;
        const { spriteSheetTextureAtlasFiles, tileSize } = Game;
        const { displayScalingOffset } = game;
        
        sceneContainer.scale.set(displayScalingOffset * 4);
        sceneContainer.sortableChildren = true;
        
        // const wallSheet = resources[spriteSheetTextureAtlasFiles.walls]?.textures ?? {};
        const mainSheet = resources[spriteSheetTextureAtlasFiles.main]?.textures ?? {};
        
        
        const generateSlot = (texture: null | Texture<Resource>, innerSize: number) => {
            const borderSizePx = 1;
            const innerDims = { width: innerSize, height: innerSize };
            const outerDims = {width: innerSize + (borderSizePx * 2), height: innerSize + (borderSizePx * 2)};
            
            const slotContainer = new Container();
            slotContainer.alpha = 0.7;
            
            const border = new Sprite(Texture.WHITE);
            border.width = outerDims.width;
            border.height = outerDims.height;
            border.tint = 0x666666;
            slotContainer.addChild(border);
            
            const bg = new Sprite(Texture.WHITE);
            bg.width = innerDims.width;
            bg.height = innerDims.height;
            bg.tint = 0x999999;
            bg.position.set(borderSizePx, borderSizePx);
            slotContainer.addChild(bg);
            
            const itemSprite = new Sprite(texture ?? Texture.WHITE);
            // itemSprite.anchor.set(0.5, 0.5);
            // itemSprite.position.set(...calcCenter(null, itemSprite));
            // itemSprite.position.set(borderSizePx + (innerDims.width - itemSprite.width), borderSizePx + (innerDims.height - itemSprite.height));
            itemSprite.width = innerDims.width;
            itemSprite.height = innerDims.height;
            itemSprite.position.set(borderSizePx, borderSizePx);
            if (texture === null) {
                itemSprite.visible = false;
            }
            slotContainer.addChild(itemSprite);
            
            const entity = new InteractableEntity({ item: slotContainer });
            
            return entity;
        };
        
        const playerInventorySlots: InteractableEntity<Container>[] = [];
        const playerSlotItemMap: (Texture<Resource> | undefined)[] = [
            undefined,
            undefined,
            mainSheet['bomb']
        ];
        
        for (let i = 0; i < 7; i++) {
            const slotEnt = generateSlot(playerSlotItemMap[i] ?? null, 14);
            slotEnt.position.set((tileSize * (1 + i)) + (tileSize / 2), (tileSize * 8) + (tileSize / 2));
            slotEnt.addTo(sceneContainer);
        }
        
        return {
            playerInventorySlots,
        };
    }
    
    getClickableObjects(): unknown[] {
        return [];
    }
    
    onTick(delta: number) {
        // noop
    }
    
}