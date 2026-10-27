# Asset sources

Three.js 0.180.0 is included under its MIT license (`vendor/THREE-LICENSE.txt`).

Planet imagery is bundled from the Three.js examples distribution, not generated or represented as original artwork:

- https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg
- https://threejs.org/examples/textures/planets/earth_normal_2048.jpg
- https://threejs.org/examples/textures/planets/earth_specular_2048.jpg
- https://threejs.org/examples/textures/planets/earth_clouds_1024.png
- https://threejs.org/examples/textures/planets/moon_1024.jpg

The image bytes are stored as JavaScript data-URL modules so that they can be committed through the connected UTF-8-only GitHub file writer. This does not require any runtime requests to an external image host.

Gas-giant band textures, atmospheric shading, and black-hole disk shading are procedural, implemented in `scene.js`.
