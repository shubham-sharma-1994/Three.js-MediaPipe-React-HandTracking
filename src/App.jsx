import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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
  const userOffsetRef = useRef(new THREE.Vector3(0.1454, -0.0083, 0.3727))
  const [ready, setReady] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [error, setError] = useState('')
  const [modelStatus, setModelStatus] = useState('Model: loading...')

  useEffect(() => {
    let animationFrameId = 0
    let disposed = false
    let handLandmarker = null
    let lastVideoTime = -1
    let watchModelLoaded = false

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

    const lightA = new THREE.HemisphereLight(0xffffff, 0x0f1222, 1.2)
    scene.add(lightA)

    const lightB = new THREE.DirectionalLight(0xffffff, 1.1)
    lightB.position.set(2.2, 2, 3)
    scene.add(lightB)

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
    const gltfLoader = new GLTFLoader()
    const applyWatchModel = (gltf) => {
        if (disposed) {
          return
        }

        const model = gltf.scene
        model.updateMatrixWorld(true)
        const bakedWatch = new THREE.Group()
        let meshCount = 0
        model.traverse((child) => {
          if (child.isMesh) {
            meshCount += 1

            const geom = child.geometry.clone()
            geom.applyMatrix4(child.matrixWorld)
            const sourceMaterial = Array.isArray(child.material)
              ? child.material[0]
              : child.material
            const material = sourceMaterial?.clone
              ? sourceMaterial.clone()
              : new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
            if (material?.color) {
              material.color.set(0xffffff)
            }
            material.side = THREE.DoubleSide
            const mesh = new THREE.Mesh(geom, material)
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.frustumCulled = false
            bakedWatch.add(mesh)
          }
        })

        const box = new THREE.Box3().setFromObject(bakedWatch)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        bakedWatch.position.sub(center)

        // Normalize model size to a predictable local unit so tracking scale is stable.
        bakedWatch.scale.setScalar(0.38 / maxDim)
        bakedWatch.rotation.set(Math.PI / 2, Math.PI, 0)
        watchGroup.add(bakedWatch)

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
      out.set((0.5 - lm.x) * 2, (0.5 - lm.y) * 2, -lm.z * 1.3)
      return out
    }

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

      const up = new THREE.Vector3().subVectors(palmV, wristV).normalize()
      const across = new THREE.Vector3().subVectors(indexV, pinkyV).normalize()
      const normal = new THREE.Vector3().crossVectors(up, across).normalize()
      const tangent = new THREE.Vector3().crossVectors(normal, up).normalize()

      const rotM = new THREE.Matrix4().makeBasis(tangent, normal, up)
      watchGroup.quaternion.setFromRotationMatrix(rotM)
      const handednessLabel = results?.handednesses?.[0]?.[0]?.categoryName
      if (handednessLabel === 'Right') {
        const rightHandFlip = new THREE.Quaternion().setFromAxisAngle(up, Math.PI)
        watchGroup.quaternion.multiply(rightHandFlip)
      }

      const wristToPalmDistance = wristV.distanceTo(palmV)
      const palmWidth = indexV.distanceTo(pinkyV)
      // Blend length + width to reduce jitter and keep a realistic wrist size.
      const handSize = wristToPalmDistance * 0.55 + palmWidth * 0.45
      const baseScale = THREE.MathUtils.clamp(handSize * 1.05, 0.11, 0.2)
      const scale = baseScale * watchScaleMultiplierRef.current
      watchGroup.scale.setScalar(scale)

      // Push slightly toward the forearm and just above skin to sit on the wrist.
      const baseOffset = up.clone().multiplyScalar(-0.52 * scale).add(normal.clone().multiplyScalar(0.11 * scale))
      const userOffsetWorld = tangent.clone().multiplyScalar(userOffsetRef.current.x * scale)
        .add(normal.clone().multiplyScalar(userOffsetRef.current.y * scale))
        .add(up.clone().multiplyScalar(userOffsetRef.current.z * scale))
      const finalOffset = baseOffset.add(userOffsetWorld)
      watchGroup.position.copy(wristV).add(finalOffset)
      watchGroup.position.z = THREE.MathUtils.clamp(watchGroup.position.z, -1.0, 0.6)
      watchGroup.visible = true
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
    </main>
  )
}

export default App
