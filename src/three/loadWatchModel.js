import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import watchModelUrl from '../assets/models/watch/model.gltf?url'
import watchModelUntexturedUrl from '../assets/models/watch/watch model un textured.gltf?url'

const TEX = {
  base:      '/assets/models/watch/803edd71df5a4711b2981690c4896410_RGB_watch_Base_Color.png',
  normal:    '/assets/models/watch/2549b22d775f4c53abff3418d150d6c9_N_watch_Normal_OpenGL.png',
  roughness: '/assets/models/watch/94416a01b4c24745a86fa3c6c1f049f5_R_watch_Roughness.png',
  metallic:  '/assets/models/watch/398991d5e63745b0a38c53d82b4ace11_R_watch_Metallic.png',
}

function loadTex(loader, url, srgb = false) {
  const t = loader.load(url)
  t.flipY = false
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function buildMaterials() {
  const loader = new THREE.TextureLoader()
  const pbrMap      = loadTex(loader, TEX.base, true)
  const pbrNormal   = loadTex(loader, TEX.normal)
  const pbrRoughness = loadTex(loader, TEX.roughness)
  const pbrMetallic  = loadTex(loader, TEX.metallic)

  return { pbrMap, pbrNormal, pbrRoughness, pbrMetallic }
}

function applyMaterials(model, mats) {
  const { pbrMap, pbrNormal, pbrRoughness, pbrMetallic } = mats
  let meshCount = 0

  model.traverse((child) => {
    if (!child.isMesh) return
    meshCount++
    const name = child.name.toLowerCase()

    if (name === 'hider') {
      child.material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
      })
      child.renderOrder = -1
    } else if (name === 'glass') {
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
  })

  return meshCount
}

function normalizeModel(model) {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  model.position.sub(center)
  model.scale.setScalar(0.38 / maxDim)
  model.rotation.set(
    THREE.MathUtils.degToRad(-75),
    THREE.MathUtils.degToRad(2),
    THREE.MathUtils.degToRad(2),
  )
}

export function loadWatchModel({ scene, watchGroup, onLoaded, onError, disposed }) {
  const mats = buildMaterials()
  const loader = new GLTFLoader()

  const apply = (gltf, statusOverride) => {
    if (disposed()) return
    const model = gltf.scene
    const meshCount = applyMaterials(model, mats)
    normalizeModel(model)
    watchGroup.add(model)
    onLoaded(model, meshCount, statusOverride)
  }

  const tryLoad = (paths, index = 0, prevErr = null) => {
    if (index >= paths.length) {
      onError(prevErr?.message || 'unknown error')
      return
    }
    const [url, status] = paths[index]
    loader.load(url, (gltf) => apply(gltf, status), undefined, (err) => tryLoad(paths, index + 1, err))
  }

  tryLoad([
    ['/assets/models/watch/model.glb', null],
    [watchModelUrl, null],
    ['/assets/models/watch/watch%20model%20un%20textured.gltf', 'Model: loaded (untextured fallback)'],
    [watchModelUntexturedUrl, 'Model: loaded (untextured fallback)'],
  ])
}
