# Orbit Foundry — Solar Atlas

**Live:** https://drugsuser.github.io/orbit-foundry/

Only the Solar System is available as an initial scenario: the Sun and eight planets. The N-body sandbox tools remain available.

## Explore

- Select a planet in the left navigator to center it at a useful, planet-specific distance.
- Mouse wheel or **+ / −** changes distance smoothly. Close zoom stops outside the tracked body's surface.
- Right-drag to orbit the camera, left-drag to pan, double-click a body to inspect it.
- **Overview / F** fits the full system; **To object** returns to a resolved planet.
- **Space** pauses orbital dynamics. **Stop rotation** separately pauses the visible axial rotation.
- **Demonstration spin** is the default: Earth makes one rotation in 40 wall-clock seconds, even when orbits are paused. Each planet has its own illustrative speed. These compressed speeds are not all accelerated by the same factor.
- **Simulation-time spin** uses sidereal periods in simulation hours. Venus and Uranus have retrograde rotation, represented with axial inclinations greater than 90 degrees, not a second reversal of the spin angle. Spin phases are illustrative, not ephemeris-calibrated.
- Natural lighting keeps day/night. The optional inspection fill helps inspect a dark hemisphere. Earth has a night-city map and a separate cloud layer.

## Visuals and limits

Each planet has its own locally hosted 2K equirectangular map, rather than a recolored Moon or shared banded texture. Jupiter and Saturn are oblate. Saturn has radially mapped transparent rings and an analytic approximate planet shadow; Uranus has faint illustrative ringlets. Planet axial inclinations and sidereal periods are based on NASA fact sheets. The longitude of each rotation axis is illustrative, not a date-specific orientation.

Texture colors are enhanced by their source; the orange Sun image is illustrative, not a white-light photograph. Saturn's ring brightness is normalized for inspection and is not a photometric/scattering simulation. Light intensity is normalized across the Solar System so outer planets remain visible. It does not represent inverse-square brightness, a full atmosphere, radiative transfer, or realistic exposure changes. The terminator follows the actual Sun position and is independent of texture rotation.

Physics remains Newtonian N-body dynamics with softened gravity and an adaptive kick–drift–kick integrator. Contacts use physical radii; minimum on-screen radii are enlarged in system view. This is not an astronomical ephemeris or a general-relativity solver.

## Run

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Desktop width >= 1000px and WebGL are required. No build step or external runtime CDN. Reduced-motion preferences disable automatic demonstration spin and camera flights.

## Assets

See [ASSET_CREDITS.md](ASSET_CREDITS.md) for texture authors, exact sources, and licenses. Three.js 0.180.0 is bundled under MIT in `vendor/`.

## Deployment

GitHub Pages: `main`, root directory, `.nojekyll`.
