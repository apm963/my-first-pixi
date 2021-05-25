import { Texture } from "@pixi/core";
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";

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

export function createDebugOverlay(overlayItem: Container, addToContainer?: Container): Sprite {
    const bg = new Sprite(Texture.WHITE);
    bg.width = overlayItem.width;
    bg.height = overlayItem.height;
    bg.tint = 0xff0000;
    bg.alpha = 0.3;
    (addToContainer ?? overlayItem).addChild(bg);
    return bg;
}