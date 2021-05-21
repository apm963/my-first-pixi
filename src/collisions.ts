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
            
            const ox = (Math.abs(vx) - r1HalfWidth);
            const oy = (Math.abs(vy) - r1HalfHeight);
            
            // console.log(`${Math.abs(oy).toFixed(2)}, ${Math.abs(ox).toFixed(2)} / oy ${(oy).toFixed(2)}, ox ${(ox).toFixed(2)}`);
            
            if (oy > 0 && ox < 0) {
                sideOfR1Bit |= (r1CenterY > r2CenterY ? HIT_UP : HIT_DOWN);
            }
            else if (oy < 0 && ox > 0) {
                sideOfR1Bit |= (r1CenterX > r2CenterX ? HIT_LEFT : HIT_RIGHT);
            }
            
            else if (Math.abs(Math.abs(vy) - r1HalfHeight) > Math.abs(Math.abs(vx) - r1HalfWidth)) {
                sideOfR1Bit |= (Math.sign(vy) === -1 ? HIT_DOWN : HIT_UP);
            }
            else {
                sideOfR1Bit |= (Math.sign(vx) === -1 ? HIT_RIGHT : HIT_LEFT);
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