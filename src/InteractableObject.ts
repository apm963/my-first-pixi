import { Dimensions, SceneObject } from "./SceneObject";

export interface Velocity {
    vx: number;
    vy: number;
}

export class InteractableObject extends SceneObject {
    
    private boundingBox: Dimensions = {
        height: null,
        width: null,
        x: null,
        y: null,
    }
    
    velocity: Velocity = {
        vx: 0,
        vy: 0,
    }
    
    getBoundingBox(): Dimensions {
        const { boundingBox, item } = this;
        return {
            width: boundingBox.width ?? ('width' in item ? item.width : 0),
            height: boundingBox.height ?? ('height' in item ? item.height : 0),
            x: boundingBox.x ?? item.x ?? 0,
            y: boundingBox.y ?? item.y ?? 0,
        }
    }
    
    setBoundingBox(dims: Dimensions) {
        Object.entries(dims).forEach(([key, val]) => {
            this.boundingBox[key] = val;
        });
    }
    
    // TODO: Event listeners
    
}