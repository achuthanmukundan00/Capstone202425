import * as PIXI from 'pixi.js';

// A simple cache keyed by arrow properties (only for arrows without labels)
const arrowCache = new Map();

export function createElectricFieldArrow(options: {
  length?: number;
  thickness?: number;
  color?: number;
  headSize?: number;
  label?: string;
  labelStyle?: Partial<PIXI.TextStyle>;
  resolution?: number;
  renderer?: PIXI.Renderer; // Provide a renderer to enable caching
}): PIXI.Container {
  const {
    length = 40,
    thickness = 2,
    color = 0xffffff,
    headSize = 8,
    label,
    renderer,
  } = options;

  const container = new PIXI.Container();

  // If there's no label and a renderer is provided, try to use the cache.
  if (!label && renderer) {
    const cacheKey = `${length}_${thickness}_${color}_${headSize}`;
    if (arrowCache.has(cacheKey)) {
      const cachedTexture = arrowCache.get(cacheKey);
      const sprite = new PIXI.Sprite(cachedTexture);
      container.addChild(sprite);
      return container;
    } else {
      // Create arrow graphics and generate a texture from it.
      const arrowGraphics = new PIXI.Graphics();
      arrowGraphics.lineStyle(thickness, color, 1);
      // Draw the shaft
      arrowGraphics.moveTo(0, 0);
      arrowGraphics.lineTo(length - headSize, 0);
      // Draw the arrowhead
      arrowGraphics.moveTo(length, 0);
      arrowGraphics.lineTo(length - headSize, -headSize / 2);
      arrowGraphics.lineTo(length - headSize, headSize / 2);
      arrowGraphics.lineTo(length, 0);
      arrowGraphics.endFill();

      // Generate a texture and cache it for future use.
      const texture = renderer.generateTexture(arrowGraphics);
      arrowCache.set(cacheKey, texture);

      const sprite = new PIXI.Sprite(texture);
      container.addChild(sprite);
      return container;
    }
  }

  // Fallback: create the arrow graphics without caching (for labeled arrows or if no renderer)
  const arrowGraphics = new PIXI.Graphics();
  arrowGraphics.lineStyle(thickness, color, 1);
  arrowGraphics.moveTo(0, 0);
  arrowGraphics.lineTo(length - headSize, 0);
  arrowGraphics.moveTo(length, 0);
  arrowGraphics.lineTo(length - headSize, -headSize / 2);
  arrowGraphics.lineTo(length - headSize, headSize / 2);
  arrowGraphics.lineTo(length, 0);
  arrowGraphics.endFill();
  container.addChild(arrowGraphics);

  return container;
}

export function createMagneticFieldSymbol(
  direction: 'in' | 'out',
  options: {
    size?: number,
    color?: number,
    alpha?: number
  }
): PIXI.Graphics {
  const { size = 8, color = 0xffffff, alpha = 1 } = options;
  const symbol = new PIXI.Graphics();
  symbol.name = 'magneticFieldSymbol';
  symbol.zIndex = 0;
  symbol.alpha = alpha;

  if (direction === 'out') {
    // ⭕ Out of the page — dot
    symbol.beginFill(color, alpha);
    symbol.drawCircle(0, 0, size / 2);
    symbol.endFill();
  } else {
    // ❌ Into the page — X
    symbol.lineStyle(2, color, alpha);
    symbol.moveTo(-size, -size);
    symbol.lineTo(size, size);
    symbol.moveTo(-size, size);
    symbol.lineTo(size, -size);
    symbol.endFill();
  }

  return symbol;
}
