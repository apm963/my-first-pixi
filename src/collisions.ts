export const HIT_LEFT = 0b0001;
export const HIT_RIGHT = 0b0010;
export const HIT_UP = 0b0100;
export const HIT_DOWN = 0b1000;
export const HIT_X = HIT_LEFT | HIT_RIGHT;
export const HIT_Y = HIT_UP | HIT_DOWN;

export type HitRectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};

/** @description Tweaked from https://github.com/kittykatattack/learningPixi#collision-detection */
export function hitTestRectangle(r1: HitRectangle, r2: HitRectangle): [false, 0b0] | [true, number] {
    
    // Find the center points of each sprite
    const r1CenterX = r1.x + r1.width / 2;
    const r1CenterY = r1.y + r1.height / 2;
    const r2CenterX = r2.x + r2.width / 2;
    const r2CenterY = r2.y + r2.height / 2;
    
    // Find the half-widths and half-heights of each sprite
    const r1HalfWidth = r1.width / 2;
    const r1HalfHeight = r1.height / 2;
    const r2HalfWidth = r2.width / 2;
    const r2HalfHeight = r2.height / 2;
    
    // Calculate the distance vector between the sprites
    const vx = r1CenterX - r2CenterX;
    const vy = r1CenterY - r2CenterY;
    
    // Figure out the combined half-widths and half-heights
    const combinedHalfWidths = r1HalfWidth + r2HalfWidth;
    const combinedHalfHeights = r1HalfHeight + r2HalfHeight;
    
    // Check for a collision on the x axis
    if (Math.abs(vx) < combinedHalfWidths) {
        // A collision might be occurring. Check for a collision on the y axis
        if (Math.abs(vy) < combinedHalfHeights) {
            // There's definitely a collision happening
            let sideOfR1Bit: number = 0b0;
            
            // This came from https://stackoverflow.com/a/13349505
            const r1Bottom = r1.y + r1.height;
            const r2Bottom = r2.y + r2.height;
            const r1Right = r1.x + r1.width;
            const r2Right = r2.x + r2.width;
            
            const collisionDown = r2Bottom - r1.y;
            const collisionUp = r1Bottom - r2.y;
            const collisionLeft = r1Right - r2.x;
            const collisionRight = r2Right - r1.x;
            
            if (collisionUp < collisionDown && collisionUp < collisionLeft && collisionUp < collisionRight) {
                sideOfR1Bit |= HIT_DOWN;
            }
            if (collisionDown < collisionUp && collisionDown < collisionLeft && collisionDown < collisionRight) {
                sideOfR1Bit |= HIT_UP;
            }
            if (collisionLeft < collisionRight && collisionLeft < collisionUp && collisionLeft < collisionDown) {
                sideOfR1Bit |= HIT_RIGHT;
            }
            if (collisionRight < collisionLeft && collisionRight < collisionUp && collisionRight < collisionDown) {
                sideOfR1Bit |= HIT_LEFT;
            }
            
            return [true, sideOfR1Bit];
        } else {
            // There's no collision on the y axis
        }
    } else {
        // There's no collision on the x axis
    }
    
    return [false, 0b0];
};