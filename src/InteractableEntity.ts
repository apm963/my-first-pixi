import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { DisplayObject } from "pixi.js";
import { Dimensions, PartialDimensions, SceneEntity } from "./SceneEntity";

export interface Velocity {
    vx: number;
    vy: number;
}

export type CollisionInfo = {
    entity: (Container | InteractableEntity<any>);
    occurred: boolean;
    sideOfEntityBit: number;
    collisions: { [directionBit: number]: (Container | InteractableEntity<any>)[] };
};

/**
 * @description The modifier that is applied to the specified bounding box.
 * When set to 'relative', the coords (x, y) are relative to the Object's coords but the size (width, height) is absolute.
 * When set to 'offset', both the coords and the size (x, y, width, height) are all factored.
 */
type BoundingBoxMode = 'relative' | 'absolute' | 'offset';

export interface SetBoundingBoxOpts {
    mode: BoundingBoxMode;
    target: Sprite;
    boundingBoxDebugOverlay: Sprite;
};

type Events = 'collision' | 'collisionSceneBoundary' | 'velocityChange' | 'click' | 'hoverEnter' | 'hoverExit';
type EventCb<R extends any[]> = (...args: R) => void;
interface EventOpts<G extends any[]> {
    once: boolean;
    predicate: (...args: G) => boolean;
};

export class InteractableEntity<T extends null | DisplayObject | Sprite | Container> extends SceneEntity<T> {
    
    boundingBoxEnabled: boolean = true;
    protected boundingBoxMode: BoundingBoxMode = 'absolute';
    
    protected boundingBox: PartialDimensions = {
        width: null,
        height: null,
        x: null,
        y: null,
    };
    
    protected boundingBoxTarget: null | Container = null;
    private boundingBoxDebugOverlay: null | Sprite = null;
    
    /** This is used with the velocity getter */
    private _velocity: Velocity = {
        vx: 0,
        vy: 0,
    };
    
    maxVelocity: Velocity = {
        vx: Infinity,
        vy: Infinity,
    };
    
    protected eventListeners: { [eventName in Events]: { cb: EventCb<any[]>; opts: Partial< EventOpts<any[]> >; }[] } = {
        'collision': [],
        'collisionSceneBoundary': [],
        'velocityChange': [],
        'click': [],
        'hoverEnter': [],
        'hoverExit': [],
    };
    
    /** velocity getter
     * @description Provides the ability to set a velocity vector using traditional methods while still triggering the
     * velocityChange event. Also provides a convenient way to set both velocity vectors.
     */
    get velocity(): Velocity & { set: InteractableEntity<T>['setVelocity'] } {
        
        const target = {
            ...this._velocity,
            set: this.setVelocity,
        };
        
        const handler: ProxyHandler<typeof target> = {
            set: (_target, prop, value) => {
                if (prop === "vx" || prop === "vy") {
                    const prevValue = this._velocity[prop];
                    this._velocity[prop] = value;
                    if (this._velocity[prop] !== prevValue) {
                        this.dispatchEvent('velocityChange', this, [prop]);
                    }
                }
                return true;
            }
        };
        
        const proxy = new Proxy(target, handler);
        
        return proxy;
    };
    
    move(delta: number, tileSize: number) {
        const oldCoords = {x: this.x, y: this.y};
        const velocity = {...this._velocity};
        if (velocity.vx !== 0) {
            this.x += Math.max(Math.min(velocity.vx, this.maxVelocity.vx), -this.maxVelocity.vx) * tileSize * delta;
        }
        if (velocity.vy !== 0) {
            this.y += Math.max(Math.min(velocity.vy, this.maxVelocity.vy), -this.maxVelocity.vy) * tileSize * delta;
        }
        return this.x !== oldCoords.x || this.y !== oldCoords.y;
    }
    
    getBoundingBox(): Dimensions {
        const { boundingBox, boundingBoxMode, item } = this;
        const itemCoalesced: Pick<Exclude<typeof item, null>, 'x' | 'y'> & { width?: number; height?: number; } = item ?? this;
        const coalescedBoundingBox: Dimensions = {
            width: boundingBox.width ?? ('width' in itemCoalesced ? (itemCoalesced.width ?? 0) : 0),
            height: boundingBox.height ?? ('height' in itemCoalesced ? (itemCoalesced.height ?? 0) : 0),
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
        return InteractableEntity.calculateBoundingBoxOffset(boundingBox, this);
    }
    
    setBoundingBox(dims: Partial<PartialDimensions>, opts: Partial<SetBoundingBoxOpts> = {}) {
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
        
        if (this.boundingBoxDebugOverlay) {
            // Force debug bounding box dimensions to be calculated and applied
            this.getBoundingBox();
        }
    }
    
    setVelocity = (velocity: Partial<Velocity>) => {
        const prevVelocity = { ...this.velocity };
        this._velocity = { ...this._velocity, ...velocity };
        if (this._velocity.vx !== prevVelocity.vx || this._velocity.vy !== prevVelocity.vy) {
            const changes: string[] = [];
            if (this._velocity.vx !== prevVelocity.vx) { changes.push('vx'); }
            if (this._velocity.vy !== prevVelocity.vy) { changes.push('vy'); }
            this.dispatchEvent('velocityChange', this, changes);
        }
        return this.velocity;
    }
    
    addEventListener<T extends any[]>(type: Events, listener: EventCb<T>, opts?: Partial< EventOpts<T> >) {
        this.eventListeners[type].push({
            cb: listener as EventCb<any[]>,
            opts: (opts as Partial<EventOpts<any[]>>) ?? {},
        });
        return this;
    }
    
    removeEventListener<T extends any[]>(type: Events, listener: EventCb<T>) {
        this.eventListeners[type] = this.eventListeners[type].filter(eventItem => eventItem.cb !== listener);
        return this;
    }
    
    dispatchEvent(type: Events, ...args: any[]) {
        for (const eventItem of this.eventListeners[type]) {
            if (eventItem.opts.predicate && !eventItem.opts.predicate(...args)) {
                // A predicate was specified but not met; do not proceed (and do not count this as "once"'d)
                continue;
            }
            const cb = eventItem.cb;
            if (eventItem.opts.once === true) {
                this.removeEventListener(type, eventItem.cb);
            }
            cb(...args);
        }
    }
    
    dispatchCollisionEvent(collisionInfo: CollisionInfo) {
        this.dispatchEvent('collision', collisionInfo);
    }
    
    static calculateBoundingBoxOffset(boundingBox: Dimensions, originObj: {x: number, y: number}): Dimensions {
        return {
            x: originObj.x - boundingBox.x,
            y: originObj.y - boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
        };
    }
    
    /**
     * @summary Makes multi-axis (diagonal) movement the same relative speed as single-axis movement
     * @description In the future this may need to be replaced with the concept of "velocity" (not public-facing vx, vy)
     * and "direction" (a value between 0 and Pi). The internal vx and vy would then be calculated from that within the move function.
     */
    static getSmoothVelocityCircular(rawVelocity: Velocity): Velocity {
        // Shallow dereference properties
        const velocity = {...rawVelocity};
        
        if (Math.abs(velocity.vx) === 0 || Math.abs(velocity.vy) === 0) {
            // This is either single-axis movement or not moving at all. We do not have to handle for this case.
            return velocity;
        }
        
        const multiplier = Math.PI / 4;
        
        velocity.vx *= multiplier;
        velocity.vy *= multiplier;
        
        return velocity;
    }
    
}