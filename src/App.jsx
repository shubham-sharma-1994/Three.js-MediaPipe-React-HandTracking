import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import watchModelUrl from './assets/models/watch/model.gltf?url'
import watchModelUntexturedUrl from './assets/models/watch/watch model un textured.gltf?url'
import './App.css'

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

function App() {
  const videoRef = useRef(null)
  const sceneHostRef = useRef(null)
  const skeletonCanvasRef = useRef(null)
  const watchScaleMultiplierRef = useRef(4)
  const userOffsetRef = useRef(new THREE.Vector3(0, 0, 0))
  // const modelRotationRef = useRef({ x: 90, y: 180, z: 90 })
  const bakedModelRef = useRef(null)
  const leftRotRef = useRef({ x: -73, y: -8, z: 11 })
  const rightRotRef = useRef({ x: -75, y: 2, z: 2 })
  const posOffsetRef = useRef({ x: 0, y: 0, z: 0 }) // gizmo (commented out below)
  const rightPosRef = useRef({ x: -0.010, y: -0.040, z: -0.025 })
  const leftPosRef  = useRef({ x:  0.000, y: -0.010, z: -0.015 })
  const [ready, setReady] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [error, setError] = useState('')
  const [modelStatus, setModelStatus] = useState('Model: loading...')
  // const [modelRot, setModelRot] = useState({ x: 90, y: 180, z: 90 })
  // const [leftRot, setLeftRot] = useState({ x: -73, y: -8, z: 11 })
  // const [rightRot, setRightRot] = useState({ x: -75, y: 2, z: 2 })
  // const [posOffset, setPosOffset] = useState({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    let animationFrameId = 0
    let disposed = false
    let handLandmarker = null
    let lastVideoTime = -1
    let watchModelLoaded = false
    let lastHandedness = null

    const host = sceneHostRef.current
    const video = videoRef.current
    const skeletonCanvas = skeletonCanvasRef.current

    if (!host || !video || !skeletonCanvas) {
      return undefined
    }

    const skeletonCtx = skeletonCanvas.getContext('2d')

    const scene = new THREE.Scene()
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    host.appendChild(renderer.domElement)

    const threeCamera = new THREE.PerspectiveCamera(36, 1, 0.01, 100)
    threeCamera.position.set(0, 0, 2.2)

    const lightA = new THREE.HemisphereLight(0xffffff, 0xffffff, 4.0)
    scene.add(lightA)

    const lightB = new THREE.DirectionalLight(0xffffff, 4.0)
    lightB.position.set(2.2, 2, 3)
    scene.add(lightB)

    const lightC = new THREE.DirectionalLight(0xffffff, 2.5)
    lightC.position.set(-2, -1, 2)
    scene.add(lightC)

    const lightD = new THREE.AmbientLight(0xffffff, 3.0)
    scene.add(lightD)

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    new RGBELoader().load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
      (hdrTexture) => {
        const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture
        scene.environment = envMap
        hdrTexture.dispose()
        pmremGenerator.dispose()
      },
    )

    const debugBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
    )
    debugBox.position.set(0, 0, 0)
    scene.add(debugBox)

    const watchGroup = new THREE.Group()
    watchGroup.visible = false
    watchGroup.position.set(0, -0.05, 0)
    watchGroup.scale.setScalar(1)
    const groupMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3355 }),
    )
    watchGroup.add(groupMarker)

    const textureLoader = new THREE.TextureLoader()
    const texBase = '/assets/models/watch/803edd71df5a4711b2981690c4896410_RGB_watch_Base_Color.png'
    const texNormal = '/assets/models/watch/2549b22d775f4c53abff3418d150d6c9_N_watch_Normal_OpenGL.png'
    const texRoughness = '/assets/models/watch/94416a01b4c24745a86fa3c6c1f049f5_R_watch_Roughness.png'
    const texMetallic = '/assets/models/watch/398991d5e63745b0a38c53d82b4ace11_R_watch_Metallic.png'
    const texAO = '/assets/models/watch/0cea018a83ab46cea0165b18f8bd6894_R_watch_Mixed_AO.png'

    const loadTex = (url, srgb = false) => {
      const t = textureLoader.load(url)
      // GLTF uses a top-left UV origin; Three.js TextureLoader flips Y by default
      // which breaks UVs on GLTF-exported models. Disable the flip.
      t.flipY = false
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      return t
    }

    const pbrMap = loadTex(texBase, true)
    const pbrNormal = loadTex(texNormal)
    const pbrRoughness = loadTex(texRoughness)
    const pbrMetallic = loadTex(texMetallic)
    const pbrAO = loadTex(texAO)

    const gltfLoader = new GLTFLoader()
    const applyWatchModel = (gltf) => {
        if (disposed) {
          return
        }

        const model = gltf.scene
        let meshCount = 0
        model.traverse((child) => {
          if (child.isMesh) {
            meshCount += 1
            const meshName = child.name.toLowerCase()
            const isHider = meshName === 'hider'
            const isGlass = meshName === 'glass'

            if (isHider) {
              child.material = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                colorWrite: false,
                depthWrite: true,
                depthTest: true,
              })
              child.renderOrder = -1
            } else if (isGlass) {
              child.material = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transmission: 0.95,
                thickness: 0.02,
                roughness: 0.05,
                metalness: 0,
                ior: 1.5,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
                side: THREE.DoubleSide,
              })
              child.renderOrder = 1
            } else {
              child.material = new THREE.MeshStandardMaterial({
                map: pbrMap,
                normalMap: pbrNormal,
                roughnessMap: pbrRoughness,
                metalnessMap: pbrMetallic,
                metalness: 1.0,
                roughness: 1.0,
                side: THREE.DoubleSide,
              })
            }

            child.castShadow = false
            child.receiveShadow = false
            child.frustumCulled = false
          }
        })

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        model.position.sub(center)

        // Normalize model size to a predictable local unit so tracking scale is stable.
        model.scale.setScalar(0.38 / maxDim)
        // Initial rotation — will be overridden per-hand on first detection.
        model.rotation.set(
          THREE.MathUtils.degToRad(-28),
          THREE.MathUtils.degToRad(124),
          THREE.MathUtils.degToRad(121),
        )
        bakedModelRef.current = model
        lastHandedness = null
        watchGroup.add(model)

        watchModelLoaded = true
        setModelStatus(`Model: loaded (${meshCount} meshes)`)
        watchGroup.remove(groupMarker)
        scene.remove(debugBox)
      }

    const loadWatchModel = () => {
      gltfLoader.load(
        '/assets/models/watch/model.glb',
        (gltf) => {
          applyWatchModel(gltf)
        },
        undefined,
        (publicErr) => {
          gltfLoader.load(
            watchModelUrl,
            (gltf) => {
              applyWatchModel(gltf)
            },
            undefined,
            (srcErr) => {
              // Final fallback: untextured model to bypass texture decode issues.
              gltfLoader.load(
                '/assets/models/watch/watch%20model%20un%20textured.gltf',
                (gltf) => {
                  applyWatchModel(gltf)
                  setModelStatus('Model: loaded (untextured fallback)')
                },
                undefined,
                () => {
                  gltfLoader.load(
                    watchModelUntexturedUrl,
                    (gltf) => {
                      applyWatchModel(gltf)
                      setModelStatus('Model: loaded (untextured fallback)')
                    },
                    undefined,
                    (untexturedErr) => {
                      const msg = untexturedErr?.message || srcErr?.message || publicErr?.message || 'unknown error'
                      setModelStatus(`Model: failed (${msg})`)
                      setError('Failed to load watch model from all paths.')
                    },
                  )
                },
              )
            },
          )
        },
      )
    }

    loadWatchModel()

    scene.add(watchGroup)

    const resize = () => {
      const width = host.clientWidth || 640
      const height = host.clientHeight || 480
      renderer.setSize(width, height)
      threeCamera.aspect = width / height
      threeCamera.updateProjectionMatrix()
      skeletonCanvas.width = width
      skeletonCanvas.height = height
    }
    resize()
    window.addEventListener('resize', resize)

    const wristV = new THREE.Vector3()
    const palmV = new THREE.Vector3()
    const indexV = new THREE.Vector3()
    const pinkyV = new THREE.Vector3()

    const toScenePoint = (lm, out) => {
      const halfH = Math.tan(THREE.MathUtils.degToRad(threeCamera.fov / 2)) * threeCamera.position.z
      out.set(
        (0.5 - lm.x) * 2 * halfH * threeCamera.aspect,
        (0.5 - lm.y) * 2 * halfH,
        -lm.z * 1.3,
      )
      return out
    }

    // Smoothed scale so the watch doesn't jitter as the hand moves toward/away.
    const smoothScaleRef = { value: 0 }

    const onResults = (results) => {
      if (disposed) {
        return
      }

      const landmarks = results?.landmarks?.[0]
      if (skeletonCtx) {
        skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height)
      }

      if (!watchModelLoaded) {
        watchGroup.visible = false
        return
      }

      if (!landmarks) {
        watchGroup.visible = false
        return
      }

      if (showSkeleton && skeletonCtx) {
        skeletonCtx.lineWidth = 3
        skeletonCtx.strokeStyle = '#43f0ff'
        skeletonCtx.fillStyle = '#ffffff'

        HAND_CONNECTIONS.forEach(([start, end]) => {
          const a = landmarks[start]
          const b = landmarks[end]
          skeletonCtx.beginPath()
          skeletonCtx.moveTo((1 - a.x) * skeletonCanvas.width, a.y * skeletonCanvas.height)
          skeletonCtx.lineTo((1 - b.x) * skeletonCanvas.width, b.y * skeletonCanvas.height)
          skeletonCtx.stroke()
        })

        landmarks.forEach((lm) => {
          skeletonCtx.beginPath()
          skeletonCtx.arc((1 - lm.x) * skeletonCanvas.width, lm.y * skeletonCanvas.height, 3, 0, Math.PI * 2)
          skeletonCtx.fill()
        })
      }

      const wrist = landmarks[0]
      const palm = landmarks[9]
      const indexMcp = landmarks[5]
      const pinkyMcp = landmarks[17]

      toScenePoint(wrist, wristV)
      toScenePoint(palm, palmV)
      toScenePoint(indexMcp, indexV)
      toScenePoint(pinkyMcp, pinkyV)

      const handednessLabel = results?.handednesses?.[0]?.[0]?.categoryName
      const up = new THREE.Vector3().subVectors(palmV, wristV).normalize()
      // For right hand the index→pinky direction is mirrored, so negate across
      // to keep the normal pointing toward the camera for both hands.
      const across = new THREE.Vector3().subVectors(indexV, pinkyV).normalize()
      if (handednessLabel === 'Right') across.negate()
      const normal = new THREE.Vector3().crossVectors(up, across).normalize()
      const tangent = new THREE.Vector3().crossVectors(normal, up).normalize()

      const rotM = new THREE.Matrix4().makeBasis(tangent, normal, up)
      watchGroup.quaternion.setFromRotationMatrix(rotM)
      if (handednessLabel !== lastHandedness && bakedModelRef.current) {
        lastHandedness = handednessLabel
        if (handednessLabel === 'Right') {
          const rr = rightRotRef.current
          bakedModelRef.current.rotation.set(
            THREE.MathUtils.degToRad(rr.x),
            THREE.MathUtils.degToRad(rr.y),
            THREE.MathUtils.degToRad(rr.z),
          )
        } else {
          const lr = leftRotRef.current
          bakedModelRef.current.rotation.set(
            THREE.MathUtils.degToRad(lr.x),
            THREE.MathUtils.degToRad(lr.y),
            THREE.MathUtils.degToRad(lr.z),
          )
        }
      }

      // Measure hand span in normalized screen space (0–1 range) so that moving
      // the hand closer to the camera increases this value naturally, just like
      // a real object getting larger as it approaches the lens.
      const screenWristToPalm = Math.hypot(palm.x - wrist.x, palm.y - wrist.y)
      const screenPalmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y)
      const screenHandSize = screenWristToPalm * 0.55 + screenPalmWidth * 0.45

      // Map screen-space hand size to a world scale. No artificial clamping — let
      // the natural perspective do the work so near = big, far = small.
      const rawScale = screenHandSize * 2.14 * watchScaleMultiplierRef.current
      // Smooth to remove per-frame jitter while still reacting quickly to movement.
      smoothScaleRef.value = smoothScaleRef.value === 0
        ? rawScale
        : smoothScaleRef.value * 0.75 + rawScale * 0.25
      const scale = smoothScaleRef.value

      const wristToPalmDistance = wristV.distanceTo(palmV)
      watchGroup.scale.setScalar(scale)

      // Push slightly toward the forearm and just above skin to sit on the wrist.
      const baseOffset = up.clone().multiplyScalar(-0.2 * wristToPalmDistance).add(normal.clone().multiplyScalar(0.12 * wristToPalmDistance))
      const userOffsetWorld = tangent.clone().multiplyScalar(userOffsetRef.current.x * scale)
        .add(normal.clone().multiplyScalar(userOffsetRef.current.y * scale))
        .add(up.clone().multiplyScalar(userOffsetRef.current.z * scale))
      const p = handednessLabel === 'Right' ? rightPosRef.current : leftPosRef.current
      const posAdjust = tangent.clone().multiplyScalar(p.x)
        .add(normal.clone().multiplyScalar(p.y))
        .add(up.clone().multiplyScalar(p.z))
      const finalOffset = baseOffset.add(userOffsetWorld).add(posAdjust)
      watchGroup.position.copy(wristV).add(finalOffset)
      watchGroup.position.z = THREE.MathUtils.clamp(watchGroup.position.z, -1.0, 0.6)
      watchGroup.visible = true

      const euler = new THREE.Euler().setFromQuaternion(watchGroup.quaternion, 'XYZ')
      console.log(
        `[${handednessLabel}] watchGroup X:${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}° Y:${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}° Z:${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}°`
      )
    }

    const animate = () => {
      if (
        handLandmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
      ) {
        lastVideoTime = video.currentTime
        const results = handLandmarker.detectForVideo(video, performance.now())
        onResults(results)
        if (!disposed) {
          setReady(true)
        }
      }

      renderer.render(scene, threeCamera)
      if (scene.children.includes(debugBox)) {
        debugBox.rotation.x += 0.01
        debugBox.rotation.y += 0.013
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    const setup = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 540, facingMode: 'user' },
          audio: false,
        })

        video.srcObject = mediaStream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.65,
          minTrackingConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
        })

        animate()
      } catch {
        setError('Camera access failed. Please allow webcam permission and refresh.')
      }
    }

    setup()

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)

      const stream = video.srcObject
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      handLandmarker?.close()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [showSkeleton])

  // const handleRightRotChange = (axis, value) => {
  //   const next = { ...rightRotRef.current, [axis]: Number(value) }
  //   rightRotRef.current = next
  //   setRightRot({ ...next })
  //   if (bakedModelRef.current) {
  //     bakedModelRef.current.rotation.set(
  //       THREE.MathUtils.degToRad(next.x),
  //       THREE.MathUtils.degToRad(next.y),
  //       THREE.MathUtils.degToRad(next.z),
  //     )
  //   }
  //   console.log(`Right hand rotation → X:${next.x}° Y:${next.y}° Z:${next.z}°`)
  // }
  // const handleRotChange = (axis, value) => { ... } // old right hand gizmo (commented)

  // const handlePosChange = (axis, value) => {
  //   const next = { ...posOffsetRef.current, [axis]: Number(value) }
  //   posOffsetRef.current = next
  //   setPosOffset({ ...next })
  //   console.log(`Position offset → X:${next.x.toFixed(3)} Y:${next.y.toFixed(3)} Z:${next.z.toFixed(3)}`)
  // }

  // const handleLeftRotChange = (axis, value) => {
  //   const next = { ...leftRotRef.current, [axis]: Number(value) }
  //   leftRotRef.current = next
  //   setLeftRot({ ...next })
  //   if (bakedModelRef.current) {
  //     bakedModelRef.current.rotation.set(
  //       THREE.MathUtils.degToRad(next.x),
  //       THREE.MathUtils.degToRad(next.y),
  //       THREE.MathUtils.degToRad(next.z),
  //     )
  //   }
  //   console.log(`Left hand rotation → X: ${next.x}°  Y: ${next.y}°  Z: ${next.z}°`)
  // }

  return (
    <main className="app">
      <video ref={videoRef} className="videoFeed" autoPlay playsInline muted />
      <div ref={sceneHostRef} className="watchLayer" />
      <canvas ref={skeletonCanvasRef} className="skeletonLayer" />

      <div className="hud">
        <h1>AR Wrist Watch</h1>
        <p>{error || (ready ? 'Tracking active' : 'Starting camera and hand tracking...')}</p>
        <p>{modelStatus}</p>
        <label className="toggleRow">
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(event) => setShowSkeleton(event.target.checked)}
          />
          <span>Show hand skeleton</span>
        </label>
      </div>

      {/* Right hand rotation gizmo — uncomment to re-enable
      <div className="rotGizmo">
        <p className="rotTitle">Right Hand Rotation</p>
        {['x', 'y', 'z'].map((axis) => (
          <label key={axis} className="rotRow">
            <span>{axis.toUpperCase()} {rightRot[axis]}°</span>
            <input type="range" min="-180" max="180" value={rightRot[axis]}
              onChange={(e) => handleRightRotChange(axis, e.target.value)} />
          </label>
        ))}
        <p className="rotValues">X:{rightRot.x}° Y:{rightRot.y}° Z:{rightRot.z}°</p>
      </div>
      */}

      {/* Left hand gizmo — uncomment to re-enable
      <div className="rotGizmo">
        <p className="rotTitle">Left Hand Rotation</p>
        {['x', 'y', 'z'].map((axis) => (
          <label key={axis} className="rotRow">
            <span>{axis.toUpperCase()} {leftRot[axis]}°</span>
            <input type="range" min="-180" max="180" value={leftRot[axis]}
              onChange={(e) => handleLeftRotChange(axis, e.target.value)} />
          </label>
        ))}
        <p className="rotValues">X:{leftRot.x}° Y:{leftRot.y}° Z:{leftRot.z}°</p>
      </div>
      */}

      {/* Position gizmo — uncomment to re-enable
      <div className="rotGizmo posGizmo">
        <p className="rotTitle">Position Offset</p>
        {[
          { axis: 'x', label: 'X (side)',  min: -0.5, max: 0.5 },
          { axis: 'y', label: 'Y (depth)', min: -0.5, max: 0.5 },
          { axis: 'z', label: 'Z (up)',    min: -0.5, max: 0.5 },
        ].map(({ axis, label, min, max }) => (
          <label key={axis} className="rotRow">
            <span>{label} {posOffset[axis].toFixed(2)}</span>
            <input type="range" min={min} max={max} step="0.005" value={posOffset[axis]}
              onChange={(e) => handlePosChange(axis, e.target.value)} />
          </label>
        ))}
        <p className="rotValues">
          X:{posOffset.x.toFixed(3)} Y:{posOffset.y.toFixed(3)} Z:{posOffset.z.toFixed(3)}
        </p>
      </div>
      */}
    </main>
  )
}

export default App
