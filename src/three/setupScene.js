import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

export function setupScene(host) {
  const scene = new THREE.Scene()

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  host.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100)
  camera.position.set(0, 0, 2.2)

  scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 4.0))

  const keyLight = new THREE.DirectionalLight(0xffffff, 4.0)
  keyLight.position.set(2.2, 2, 3)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 2.5)
  fillLight.position.set(-2, -1, 2)
  scene.add(fillLight)

  scene.add(new THREE.AmbientLight(0xffffff, 3.0))

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  new RGBELoader().load(
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
    (hdr) => {
      scene.environment = pmrem.fromEquirectangular(hdr).texture
      hdr.dispose()
      pmrem.dispose()
    },
  )

  return { scene, renderer, camera }
}

export function setupResize(host, renderer, camera, skeletonCanvas) {
  const resize = () => {
    const width = host.clientWidth || 640
    const height = host.clientHeight || 480
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    skeletonCanvas.width = width
    skeletonCanvas.height = height
  }
  resize()
  window.addEventListener('resize', resize)
  return () => window.removeEventListener('resize', resize)
}
