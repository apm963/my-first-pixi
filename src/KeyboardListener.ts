/** @description Tweaked from https://github.com/kittykatattack/learningPixi#keyboard-movement */
export class KeyboardListener {
    isDown = false;
    isUp = true;
    press: null | ((event: KeyboardEvent) => void) = null;
    release: null | ((event: KeyboardEvent) => void) = null;
    
    constructor(public value: KeyboardEvent['code']) {
        window.addEventListener("keydown", this.downHandler, false);
        window.addEventListener("keyup", this.upHandler, false);
    }
    
    downHandler = (event: KeyboardEvent) => {
        if (event.code !== this.value) {
            return;
        }
        if (this.isUp && this.press) this.press(event);
        this.isDown = true;
        this.isUp = false;
        event.preventDefault();
    };
    
    upHandler = (event: KeyboardEvent) => {
        if (event.code !== this.value) {
            return;
        }
        if (this.isDown && this.release) this.release(event);
        this.isDown = false;
        this.isUp = true;
        event.preventDefault();
    };
    
    /** Detach event listeners */
    unsubscribe = () => {
        window.removeEventListener("keydown", this.downHandler);
        window.removeEventListener("keyup", this.upHandler);
    };
    
}