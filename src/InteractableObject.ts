import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Dimensions, PartialDimensions, SceneObject } from "./SceneObject";

export interface Velocity {
    vx: number;
    vy: number;
}

/** 
 * @description The modifier that is applied to the specified bounding box.
 * When set to 'relative', the coords (x, y) are relative to the Object's coords but the size (width, height) is absolute.
 * When set to 'offset', both the coords and the size (x, y, width, height) are all factored.
 */
type BoundingBoxMode = 'relative' | 'absolute' | 'offset';

export class InteractableObject extends SceneObject {
    
    protected boundingBoxMode: BoundingBoxMode = 'absolute';
    
    protected boundingBox: PartialDimensions = {
        width: null,
        height: null,
        x: null,
        y: null,
    };
    
    protected boundingBoxTarget: null | Container = null;
    private boundingBoxDebugOverlay: null | Sprite = null;
    
    velocity: Velocity = {
        vx: 0,
        vy: 0,
    };
    
    getBoundingBox(): Dimensions {
        const { boundingBox, boundingBoxMode, item } = this;
        const itemCoalesced = item ?? ({} as Partial< Exclude<typeof item, null> >); // REVIEW: Should it be `this` instead?
        const coalescedBoundingBox: Dimensions = {
            width: boundingBox.width ?? ('width' in itemCoalesced ? itemCoalesced.width : 0),
            height: boundingBox.height ?? ('height' in itemCoalesced ? itemCoalesced.height : 0),
            x: boundingBox.x ?? itemCoalesced.x ?? 0,
            y: boundingBox.y ?? itemCoalesced.y ?? 0,
        };
        
        let calculatedBoundingBox: Dimensions;
        
        if (boundingBoxMode === 'absolute') {
            calculatedBoundingBox = coalescedBoundingBox;
        }
        else if (boundingBoxMode === 'relative') {
            // REVIEW: This has not yet been tested so it may not be implemented correctly
            calculatedBoundingBox = {
                ...coalescedBoundingBox,
                x: coalescedBoundingBox.x + this.x,
                y: coalescedBoundingBox.y + this.y,
            };
        }
        else {
            calculatedBoundingBox = {
                width: this.width + (boundingBox.width ?? 0),
                height: this.height + (boundingBox.height ?? 0),
                x: this.x + (boundingBox.x ?? 0),
                y: this.y + (boundingBox.y ?? 0),
            };
            // Handle mirrored sprite
            const targetMirroredXSine = Math.sign((this.boundingBoxTarget ?? this.item)?.scale?.x ?? 1);
            if (targetMirroredXSine === -1) {
                calculatedBoundingBox.x = this.x + this.width - coalescedBoundingBox.x - calculatedBoundingBox.width;
            }
            const targetMirroredYSine = Math.sign((this.boundingBoxTarget ?? this.item)?.scale?.y ?? 1);
            if (targetMirroredYSine === -1) {
                calculatedBoundingBox.y = this.y + this.height - coalescedBoundingBox.y - calculatedBoundingBox.height;
            }
        }
        
        // Bounding box overlay for debugging
        if (this.boundingBoxDebugOverlay) {
            this.boundingBoxDebugOverlay.position.set(calculatedBoundingBox.x, calculatedBoundingBox.y);
            this.boundingBoxDebugOverlay.width = (calculatedBoundingBox.width);
            this.boundingBoxDebugOverlay.height = (calculatedBoundingBox.height);
        }
        
        return calculatedBoundingBox;
    }
    
    calculateBoundingBoxOffsetFromOrigin(boundingBox: Dimensions): Dimensions {
        return {
            x: this.x - boundingBox.x,
            y: this.y - boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
        };
    }
    
    setBoundingBox(dims: Partial<PartialDimensions>, opts: Partial<{ mode: BoundingBoxMode; target: Sprite; boundingBoxDebugOverlay: Sprite; }> = {}) {
        this.boundingBoxMode = opts.mode ?? 'relative';
        this.boundingBoxTarget = opts.target ?? null;
        this.boundingBoxDebugOverlay = opts.boundingBoxDebugOverlay ?? null;
        
        for (const key in dims) {
            const prop = key as keyof PartialDimensions;
            const val = dims[prop];
            if (typeof val === 'undefined') {
                return;
            }
            this.boundingBox[prop] = val;
        }
    }
    
    // TODO: Event listeners
    
}