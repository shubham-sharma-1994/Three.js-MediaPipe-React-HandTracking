import * as THREE from 'three'
import { HAND_CONNECTIONS, HAND_ROT, HAND_POS } from '../constants.js'

const wristV = new THREE.Vector3()
const palmV  = new THREE.Vector3()
const indexV = new THREE.Vector3()
const pinkyV = new THREE.Vector3()

const smoothScale = { value: 0 }
let lastHandedness = null

export function resetTracking() {
  smoothScale.value = 0
  lastHandedness = null
}

function toScenePoint(lm, out, camera) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
  out.set(
    (0.5 - lm.x) * 2 * halfH * camera.aspect,
    (0.5 - lm.y) * 2 * halfH,
    -lm.z * 1.3,
  )
}

function drawSkeleton(ctx, landmarks, canvasW, canvasH) {
  ctx.lineWidth = 3
  ctx.strokeStyle = '#43f0ff'
  ctx.fillStyle = '#ffffff'

  HAND_CONNECTIONS.forEach(([s, e]) => {
    const a = landmarks[s]
    const b = landmarks[e]
    ctx.beginPath()
    ctx.moveTo((1 - a.x) * canvasW, a.y * canvasH)
    ctx.lineTo((1 - b.x) * canvasW, b.y * canvasH)
    ctx.stroke()
  })

  landmarks.forEach((lm) => {
    ctx.beginPath()
    ctx.arc((1 - lm.x) * canvasW, lm.y * canvasH, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function updateWatch({ results, watchGroup, bakedModel, camera, skeletonCtx, skeletonCanvas, showSkeleton, watchModelLoaded }) {
  const landmarks = results?.landmarks?.[0]

  if (skeletonCtx) {
    skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height)
  }

  if (!watchModelLoaded || !landmarks) {
    watchGroup.visible = false
    return
  }

  if (showSkeleton && skeletonCtx) {
    drawSkeleton(skeletonCtx, landmarks, skeletonCanvas.width, skeletonCanvas.height)
  }

  const wrist    = landmarks[0]
  const palm     = landmarks[9]
  const indexMcp = landmarks[5]
  const pinkyMcp = landmarks[17]

  toScenePoint(wrist,    wristV, camera)
  toScenePoint(palm,     palmV,  camera)
  toScenePoint(indexMcp, indexV, camera)
  toScenePoint(pinkyMcp, pinkyV, camera)

  const handedness = results?.handednesses?.[0]?.[0]?.categoryName
  const isRight = handedness === 'Right'

  const up     = new THREE.Vector3().subVectors(palmV, wristV).normalize()
  const across = new THREE.Vector3().subVectors(indexV, pinkyV).normalize()
  if (isRight) across.negate()
  const normal  = new THREE.Vector3().crossVectors(up, across).normalize()
  const tangent = new THREE.Vector3().crossVectors(normal, up).normalize()

  watchGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, normal, up))

  if (handedness !== lastHandedness && bakedModel) {
    lastHandedness = handedness
    const rot = isRight ? HAND_ROT.right : HAND_ROT.left
    bakedModel.rotation.set(
      THREE.MathUtils.degToRad(rot.x),
      THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z),
    )
  }

  const screenHandSize =
    Math.hypot(palm.x - wrist.x, palm.y - wrist.y) * 0.55 +
    Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y) * 0.45

  const rawScale = screenHandSize * 2.14 * 4
  smoothScale.value = smoothScale.value === 0 ? rawScale : smoothScale.value * 0.75 + rawScale * 0.25
  const scale = smoothScale.value

  const wristToPalmDist = wristV.distanceTo(palmV)
  watchGroup.scale.setScalar(scale)

  const pos = isRight ? HAND_POS.right : HAND_POS.left
  const offset = up.clone().multiplyScalar(-0.2 * wristToPalmDist)
    .add(normal.clone().multiplyScalar(0.12 * wristToPalmDist))
    .add(tangent.clone().multiplyScalar(pos.x))
    .add(normal.clone().multiplyScalar(pos.y))
    .add(up.clone().multiplyScalar(pos.z))

  watchGroup.position.copy(wristV).add(offset)
  watchGroup.position.z = THREE.MathUtils.clamp(watchGroup.position.z, -1.0, 0.6)
  watchGroup.visible = true
}
