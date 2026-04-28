# AR Wrist Watch — Three.js + MediaPipe + React

A real-time augmented reality application that overlays a 3D watch model onto your wrist using webcam-based hand tracking. Built with React, Three.js, and Google MediaPipe Tasks Vision.

## Features

- Real-time hand landmark detection via MediaPipe (GPU delegate)
- 3D watch model anchored to the wrist with correct orientation for both left and right hands
- Perspective-correct scaling — the watch grows and shrinks naturally as you move toward or away from the camera
- PBR materials — base color, normal, roughness, and metalness maps applied to the watch model
- HDR environment map for realistic metal reflections (loaded from Poly Haven)
- Hider mesh support — occludes geometry behind it by writing to the depth buffer without drawing pixels
- Glass mesh support — physically-based translucent material using `MeshPhysicalMaterial`
- Optional hand skeleton overlay rendered on a 2D canvas
- Per-hand baked rotation and position offsets so the watch sits correctly on each wrist

## Tech Stack

| Library | Version | Role |
|---|---|---|
| React | 19 | UI and component lifecycle |
| Vite | 8 | Build tool and dev server |
| Three.js | 0.184 | 3D rendering, PBR materials, scene graph |
| @mediapipe/tasks-vision | 0.10.35 | Hand landmark detection |
| RGBELoader | (Three.js addon) | HDR environment map loading |
| GLTFLoader | (Three.js addon) | 3D model loading |

## Prerequisites

- Node.js 18+
- A webcam
- A modern browser with WebGL and WebAssembly support (Chrome/Edge recommended for GPU delegate)

## Getting Started

```bash
git clone <repository-url>
cd Three.js-MediaPipe-React-HandTracking
npm install
npm run dev
```

Open `http://localhost:5173` and grant webcam permission when prompted.

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
src/
├── App.jsx                        # Root component — refs, state, layout
├── App.css                        # All styles
├── constants.js                   # Hand connections, per-hand rotation & position config
├── components/
│   └── Hud.jsx                    # HUD overlay (status, skeleton toggle)
├── hooks/
│   └── useHandTracking.js         # MediaPipe init, animation loop, cleanup
├── three/
│   ├── setupScene.js              # Renderer, camera, lights, HDR env map, resize
│   ├── loadWatchModel.js          # GLTF loading with fallbacks, PBR material setup
│   └── updateWatch.js             # Per-frame: hand pose → watch transform + skeleton draw
└── assets/
    └── models/watch/              # GLTF source files and PBR textures

public/
└── assets/
    └── models/watch/              # Runtime-served model assets (GLB + textures)
```

## How It Works

### Hand Tracking
MediaPipe detects 21 landmarks per hand every video frame. Four key landmarks are used to derive the wrist coordinate frame:

- **Landmark 0** (wrist) and **Landmark 9** (palm base) → `up` axis
- **Landmark 5** (index MCP) and **Landmark 17** (pinky MCP) → `across` vector
- `normal = up × across` (across is negated for the right hand to keep normal facing the camera)
- `tangent = normal × up`

These three vectors form a rotation matrix that orients the watch group to match the hand's orientation in 3D space.

### Perspective Scaling
Scale is derived entirely from the 2D screen-space distance between landmarks (in normalized 0–1 coordinates). As the hand moves closer to the camera, landmarks spread further apart → watch gets larger. Moving away → watch gets smaller. This is the only reliable depth signal from a single RGB webcam.

### Per-hand Configuration
Each hand has its own baked model rotation and position offset stored in `src/constants.js`:

```js
export const HAND_ROT = {
  right: { x: -75, y: 2,  z: 2  },
  left:  { x: -73, y: -8, z: 11 },
}

export const HAND_POS = {
  right: { x: -0.010, y: -0.040, z: -0.025 },
  left:  { x:  0.000, y: -0.010, z: -0.015 },
}
```

The baked rotation is only re-applied when the detected handedness changes, not every frame.

### Model Loading
The GLTF loader tries four paths in sequence, falling back to the next on failure:

1. `/assets/models/watch/model.glb` (public folder, optimised GLB)
2. Vite asset URL for `model.gltf`
3. `/assets/models/watch/watch%20model%20un%20textured.gltf`
4. Vite asset URL for the untextured fallback

### PBR Textures
All textures are loaded with `flipY = false` to match the GLTF UV convention (top-left origin). The base color texture is loaded with `SRGBColorSpace`. AO map is omitted because the model only has one UV channel.

### Special Meshes
- **`hider`** — rendered at `renderOrder = -1` with `colorWrite: false` and `depthWrite: true`. Invisible but writes depth, occluding anything behind it.
- **`glass`** — rendered at `renderOrder = 1` with `MeshPhysicalMaterial` (`transmission: 0.95`, `ior: 1.5`, `opacity: 0.2`).

## Deployment (Firebase Hosting)

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "dist", configure as SPA
firebase deploy
```

Firebase Hosting serves over HTTPS, which is required for `getUserMedia` webcam access.

## Troubleshooting

| Problem | Fix |
|---|---|
| Watch model not loading | Check that `public/assets/models/watch/model.glb` exists |
| Webcam not detected | Allow camera permission; only one tab can use the camera at a time |
| Textures look wrong / inverted | Confirm all textures are loaded with `flipY = false` |
| Poor tracking in low light | Improve lighting; MediaPipe needs clear hand contrast |
| High CPU/GPU usage | Open in Chrome/Edge with hardware acceleration enabled |

## Linting

```bash
npm run lint
```
