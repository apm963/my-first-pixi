import { Loader, Resource, Sprite, TextStyle, Text, Texture } from "pixi.js";
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
import { MainScene } from "./MainScene";

type SceneObjects = {
    playerInventorySlots: InteractableEntity<Container>[];
};

export class UiHudScene extends GameSceneBase implements UiSceneIface<SceneObjects> {
    
    items: SceneObjects;
    
    // static mapSize = { width: 10, height: 10 };
    
    slotDataMap: { [slotIndex: number]: { slotEnt: InteractableEntity<Container>; slotItemSprite: Sprite; setQtyText: (updatedQty: number) => void; }} = {};
    
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
        
        const qtyTextStyle = new TextStyle({ fill: 'white', fontSize: 42, stroke: '#333333', strokeThickness: 8 });
        
        const generateSlot = (texture: null | Texture<Resource>, innerSize: number, itemQty: number): [InteractableEntity<Container>, Sprite, (updatedQty: number) => void] => {
            const borderSizePx = 1;
            const innerDims = { width: innerSize, height: innerSize };
            const outerDims = {width: innerSize + (borderSizePx * 2), height: innerSize + (borderSizePx * 2)};
            
            const slotContainer = new Container();
            // slotContainer.alpha = 0.7;
            
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
            
            const qtyText = new Text('1', qtyTextStyle); // Create text with placeholder value
            // Invert scale applied by scene so text is crisp. Not to say we can't have pixelated text to fit the theme.
            qtyText.scale.set(1 / sceneContainer.scale.x);
            // Position text in bottom-right of slot
            qtyText.anchor.set(1, 1);
            qtyText.position.set(slotContainer.width, slotContainer.height);
            // Create hook to allow updating the displayed qty at some point in the future
            const setQtyText = (updatedQty: number) => {
                qtyText.text = `${updatedQty || ''}`; // Render qty if slot has item
                qtyText.x = slotContainer.width;
            };
            setQtyText(itemQty); // Set text to actual quantity
            
            slotContainer.addChild(qtyText);
            
            const entity = new InteractableEntity({ item: slotContainer });
            
            return [entity, itemSprite, setQtyText];
        };
        
        const playerInventorySlots: InteractableEntity<Container>[] = [];
        const playerSlotItemMap: ({ texture: Texture<Resource>; qty: number; } | undefined)[] = []; // TODO: Support loading save
        
        for (let i = 0; i < 7; i++) {
            const playerSlotItem = playerSlotItemMap[i] ?? null;
            const [slotEnt, slotItemSprite, setQtyText] = generateSlot(playerSlotItem?.texture ?? null, 14, playerSlotItem?.qty ?? 0);
            slotEnt.position.set((tileSize * (1 + i)) + (tileSize / 2), (tileSize * 8) + (tileSize / 2));
            slotEnt.addTo(sceneContainer);
            this.slotDataMap[i] = { slotEnt, slotItemSprite, setQtyText };
        }
        
        return {
            playerInventorySlots,
        };
    }
    
    getClickableObjects(): unknown[] {
        return [];
    }
    
    onTick(delta: number) {
        
        // TODO: Widen this
        if (!(this.game.currentScene instanceof MainScene)) {
            return;
        }
        
        const { playerChar } = this.game.currentScene.items;
        
        // Update slots
        const len = Object.keys(this.slotDataMap).length;
        
        for (let i = 0; i < len; i++) {
            const invItem = playerChar.inventory.getItemInSlot(i);
            const slotData = this.slotDataMap[i];
            const { slotItemSprite, setQtyText } = slotData;
            
            if (invItem === null) {
                if (slotItemSprite.texture !== Texture.WHITE) {
                    slotItemSprite.texture = Texture.WHITE;
                    slotItemSprite.visible = false;
                    setQtyText(0);
                }
            }
            else if (invItem.sprite instanceof Sprite) {
                if (slotItemSprite.texture !== invItem.sprite.texture) {
                    slotItemSprite.texture = invItem.sprite.texture;
                    slotItemSprite.visible = true;
                    setQtyText(invItem.qty);
                }
            }
        }
        
    }
    
}