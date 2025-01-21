# project-cynthia

Created by Justin Chang, Son Phatpanichot, Mehdi Essoussi, and Achu Mukundan

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
## PixiJS Version Compatibility

- **PixiJS Version 7**: The method `app.renderer.resize(width, height)` is specific to this version, as documented in the [PixiJS v7 Application Renderer Docs](https://pixijs.download/v7.x/docs/PIXI.Application.html#renderer).
- **PixiJS Version 4.8.9**: The methods `beginFill`, `lineStyle`, `drawCircle`, and `endFill` are **deprecated** as per the [PixiJS 4.8.9 documentation](https://pixijs.download/v4.8.9/docs/PIXI.Graphics.html).

## Categorization of PixiJS Features

### Containers
- **`PIXI.Application`**: Core container for rendering.
- **`app.stage`**: The root container of the scene graph.

### Methods

#### Drawing Graphics
- `graphic.beginFill(color)` - **Deprecated in PixiJS 4.8.9**  
  Reference: [PixiJS 4.8.9 Docs](https://pixijs.download/v4.8.9/docs/PIXI.Graphics.html#beginFill)
- `graphic.lineStyle(width)` - **Deprecated in PixiJS 4.8.9**  
  Reference: [PixiJS 4.8.9 Docs](https://pixijs.download/v4.8.9/docs/PIXI.Graphics.html#lineStyle)
- `graphic.drawCircle(x, y, radius)` - **Deprecated in PixiJS 4.8.9**  
  Reference: [PixiJS 4.8.9 Docs](https://pixijs.download/v4.8.9/docs/PIXI.Graphics.html#drawCircle)
- `graphic.endFill()` - **Deprecated in PixiJS 4.8.9**  
  Reference: [PixiJS 4.8.9 Docs](https://pixijs.download/v4.8.9/docs/PIXI.Graphics.html#endFill)
- `graphic.clear()`
- `app.renderer.resize(width, height)`  
  Introduced in PixiJS 7.  
  Reference: [PixiJS 7 Docs](https://pixijs.download/v7.x/docs/PIXI.Application.html#renderer)
- `graphic.position.set(x, y)`

### Events
- `app.stage.on(event, callback)`
- `graphic.on(event, callback)`

### Properties
- `app.stage.interactive`
- `graphic.interactive`
- `graphic.buttonMode`
