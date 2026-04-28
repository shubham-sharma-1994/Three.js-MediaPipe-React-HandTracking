import { useRef, useState } from 'react'
import { useHandTracking } from './hooks/useHandTracking.js'
import { Hud } from './components/Hud.jsx'
import './App.css'

function App() {
  const videoRef        = useRef(null)
  const sceneHostRef    = useRef(null)
  const skeletonCanvasRef = useRef(null)

  const [ready, setReady]             = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [error, setError]             = useState('')
  const [modelStatus, setModelStatus] = useState('Model: loading...')

  useHandTracking({
    videoRef,
    sceneHostRef,
    skeletonCanvasRef,
    showSkeleton,
    setReady,
    setError,
    setModelStatus,
  })

  return (
    <main className="app">
      <video ref={videoRef} className="videoFeed" autoPlay playsInline muted />
      <div ref={sceneHostRef} className="watchLayer" />
      <canvas ref={skeletonCanvasRef} className="skeletonLayer" />
      <Hud
        ready={ready}
        error={error}
        modelStatus={modelStatus}
        showSkeleton={showSkeleton}
        onSkeletonToggle={setShowSkeleton}
      />
    </main>
  )
}

export default App
