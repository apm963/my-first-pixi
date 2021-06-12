import { Container, DisplayObject, Sprite } from 'pixi.js';
import { v4 as uuidv4 } from 'uuid';

export interface Dimensions {
    width: number;
    height: number;
    x: number;
    y: number;
}

export interface PartialDimensions {
    width: null | number;
    height: null | number;
    x: null | number;
    y: null | number;
}

type Geometry = PartialDimensions & { zIndex: null | number; };

interface Opts {
    item?: SceneEntity['item'];
    /** @description Used to identify this specific entity instance. Useful for debugging */
    name?: SceneEntity['name'];
    bindZToY?: SceneEntity['bindZToY'];
    forceZInt?: SceneEntity['forceZInt'];
    geometry?: PartialDimensions;
    mirrorTarget?: SceneEntity['mirrorTarget'];
}

export class SceneEntity {
    
    protected geometry: Geometry = {
        width: null,
        height: null,
        x: null,
        y: null,
        zIndex: null,
    };
    
    bindZToY: boolean = false;
    forceZInt: boolean = false; // REVIEW: Current technique is Math.round. Reevaluate if this is desired (or desired as a setting)
    item: null | DisplayObject | Sprite | Container = null;
    name: string = uuidv4();
    mirrorTarget: null | Sprite = null;
    
    get width(): number {
        const { item, geometry } = this;
        return geometry.width ?? (item && 'width' in item ? item.width : 0);
    }
    
    get height(): number {
        const { item, geometry } = this;
        return geometry.height ?? (item && 'height' in item ? item.height : 0);
    }
    
    get x(): number {
        const { item, geometry } = this;
        return geometry.x ?? item?.x ?? 0;
    }
    
    get y(): number {
        const { item, geometry } = this;
        return geometry.y ?? item?.y ?? 0;
    }
    
    get zIndex(): number {
        const { item, geometry } = this;
        return geometry.zIndex ?? item?.zIndex ?? 0;
    }
    
    set width(val: number) {
        this.setDimension('width', val);
    }
    
    set height(val: number) {
        this.setDimension('height', val);
    }
    
    set x(val: number) {
        this.setDimension('x', val);
    }
    
    set y(val: number) {
        this.setDimension('y', val);
    }
    
    set zIndex(val: number) {
        this.setDimension('zIndex', val);
    }
    
    constructor(opts: Opts = {}) {
        Object.entries(opts).forEach(([key, val]) => this[key as keyof this] = val);
    }
    
    /** @description A helper method to get dimensions. Do not use this for setting. */
    getDimensions() {
        return {...this.geometry};
    }
    
    protected setDimension(geometry: keyof SceneEntity['geometry'], val: number) {
        
        if (geometry === 'zIndex' && this.forceZInt) {
            val = Math.round(val);
        }
        
        if (this.item && geometry in this.item) {
            // @ts-ignore The index lookup has already been established above. REVIEW: Can this be improved?
            this.item[geometry] = val;
            if (geometry === 'y' && this.bindZToY) {
                this.item.zIndex = (this.forceZInt ? Math.round(val) : val);
            }
        }
        else {
            this.geometry[geometry] = val;
        }
    }
    
    mirrorX(sine?: number) {
        const mirrorItem = this.mirrorTarget ?? this.item;
        if (mirrorItem === null) {
            return false;
        }
        mirrorItem.scale.x *= sine ?? -1;
        return true;
    }
    
    addTo(container: Container): boolean {
        if (this.item) {
            container.addChild(this.item);
            return true;
        }
        return false;
    }
    
}