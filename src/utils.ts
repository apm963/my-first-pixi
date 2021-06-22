import { Texture } from "@pixi/core";
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { InteractableEntity } from "./InteractableEntity";

export const tau = Math.PI * 2;

export function calcCenter(sprite: null | { width: number, height: number }, container: null | { width: number, height: number }): [number, number] {
    sprite = sprite ?? { width: 0, height: 0 };
    container = container ?? { width: 0, height: 0 };
    return [
        (container.width / 2) - (sprite.width / 2),
        (container.height / 2) - (sprite.height / 2)
    ];
}

export function calcSpritePosCentered(x: number, y: number, sprite: { width: number, height: number }, scale: number = 1) {
    return [
        (x * scale) + (sprite.width / 2),
        (y * scale) + (sprite.height / 2)
    ];
}

export function calcScaledPos(x: number, y: number, scale: number = 1) {
    return [
        (x * scale),
        (y * scale)
    ];
}

export function randomTrue(chanceFloat: number) {
    return Math.random() < chanceFloat;
}

export function createDebugOverlay(overlayItem: Container | InteractableEntity<any>, addToContainer?: Container, opts?: Partial<Sprite>): Sprite {
    const bg = new Sprite(Texture.WHITE);
    bg.x = overlayItem.x;
    bg.y = overlayItem.y;
    bg.width = overlayItem.width;
    bg.height = overlayItem.height;
    bg.tint = 0xff0000;
    bg.alpha = 0.3;
    Object.entries(opts ?? {}).forEach(([key, val]) => (bg[key as keyof typeof opts] as any) = val);
    if (overlayItem instanceof InteractableEntity) {
        const item = (addToContainer ?? overlayItem.item);
        item && 'addChild' in item && item.addChild(bg);
    }
    else {
        (addToContainer ?? overlayItem).addChild(bg);
    }
    return bg;
}

export function calcZFromGeometry(geometry: {y: number, height: number}, tileSize: number, mathFloor: boolean = false) {
    const zIndex = (geometry.y + geometry.height) / tileSize;
    return (mathFloor ? Math.floor(zIndex) : zIndex);
}