import 'pixi.js';

declare module 'pixi.js' {
  interface Graphics {
    data?: PIXI.InteractionData;
    dragging?: boolean;
    buttonMode: boolean;
  }
}