import { Game } from './Game';

const game = new Game(window.devicePixelRatio, {width: window.innerWidth, height: window.innerHeight});

game.app.renderer.view.style.position = "absolute";
game.app.renderer.view.style.display = "block";

// Add the canvas that Pixi automatically created for you to the HTML document
document.body.appendChild(game.app.view);

game.load(game.setup);
