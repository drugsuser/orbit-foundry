# Orbit Foundry

A desktop gravitational sandbox: direct 3D N-body dynamics, orbital construction, launch planning, impacts, black holes, and a Three.js/WebGL planetary renderer.

**Live site:** https://drugsuser.github.io/orbit-foundry/

## Run locally

Serve this directory over HTTP, for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. No npm install/build or external runtime CDN is required. Desktop browsers only (minimum width 1000 px); WebGL is required for the new renderer.

## Controls

- Left mouse: select/pan; right mouse: rotate; wheel: zoom.
- Space: pause, `.`: step, F: fit system, C: follow.
- 1–4: select, circular orbit, launch, delete. G: field, H: help, Tab: clean view.
- **Overview** fits the system. **To planet** resolves the selected planet.
- Launch vectors are world-frame by default. Relative launches are explicit. The chosen orbital center remains pinned.

## Model boundaries

Physics remains Newtonian with a softened pair potential and adaptive kick–drift–kick integration. A limited central precession correction is available near black holes. This is not full general relativity, a hydrodynamics solver, or an astronomical ephemeris. Field meshes and accretion visuals are illustrative. Minimum visible body radii are enlarged at large distances; collision radii remain physical.

## Files

- `index.html`, `style.css`: UI.
- `engine.js`: N-body engine and gameplay.
- `scene.js`: Three.js renderer, lighting, atmosphere, materials.
- `vendor/`: pinned Three.js 0.180.0, MIT license included.
- `assets/*.js`: locally bundled image data. Source Earth/Moon images are distributed with the Three.js examples: https://threejs.org/examples/textures/planets/ . The original source filenames and URLs are listed in `ASSET_CREDITS.md`.

## Deployment

GitHub Pages, branch `main`, root directory. `.nojekyll` serves the files directly. The site is public and does not contain credentials, analytics, or a backend.
