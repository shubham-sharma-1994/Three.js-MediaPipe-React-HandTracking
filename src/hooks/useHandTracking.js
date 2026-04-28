import { useEffect } from 'react'
import * as THREE from 'three'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { setupScene, setupResize } from '../three/setupScene.js'
import { loadWatchModel } from '../three/loadWatchModel.js'
import { updateWatch, resetTracking } from '../three/updateWatch.js'

export function useHandTracking({ videoRef, sceneHostRef, skeletonCanvasRef, showSkeleton, setReady, setError, setModelStatus }) {
  useEffect(() => {
    let animationFrameId = 0
    let disposed = false
    let handLandmarker = null
    let lastVideoTime = -1
    let watchModelLoaded = false
    let bakedModel = null

    const host   = sceneHostRef.current
    const video  = videoRef.current
    const skeletonCanvas = skeletonCanvasRef.current
    if (!host || !video || !skeletonCanvas) return

    const skeletonCtx = skeletonCanvas.getContext('2d')
    const { scene, renderer, camera } = setupScene(host)
    const cleanupResize = setupResize(host, renderer, camera, skeletonCanvas)

    const debugBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
    )
    scene.add(debugBox)

    const watchGroup = new THREE.Group()
    watchGroup.visible = false
    const groupMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3355 }),
    )
    watchGroup.add(groupMarker)
    scene.add(watchGroup)

    resetTracking()

    loadWatchModel({
      scene,
      watchGroup,
      disposed: () => disposed,
      onLoaded: (model, meshCount, statusOverride) => {
        bakedModel = model
        watchModelLoaded = true
        setModelStatus(statusOverride ?? `Model: loaded (${meshCount} meshes)`)
        watchGroup.remove(groupMarker)
        scene.remove(debugBox)
      },
      onError: (msg) => {
        setModelStatus(`Model: failed (${msg})`)
        setError('Failed to load watch model from all paths.')
      },
    })

    const animate = () => {
      if (handLandmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const results = handLandmarker.detectForVideo(video, performance.now())
        updateWatch({ results, watchGroup, bakedModel, camera, skeletonCtx, skeletonCanvas, showSkeleton, watchModelLoaded })
        if (!disposed) setReady(true)
      }

      renderer.render(scene, camera)
      if (scene.children.includes(debugBox)) {
        debugBox.rotation.x += 0.01
        debugBox.rotation.y += 0.013
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 540, facingMode: 'user' },
          audio: false,
        })
        video.srcObject = stream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
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
      cleanupResize()
      const stream = video.srcObject
      if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop())
      handLandmarker?.close()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [showSkeleton])
}
