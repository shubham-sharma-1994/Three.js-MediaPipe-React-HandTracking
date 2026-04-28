export function Hud({ ready, error, modelStatus, showSkeleton, onSkeletonToggle }) {
  return (
    <div className="hud">
      <h1>AR Wrist Watch</h1>
      <p>{error || (ready ? 'Tracking active' : 'Starting camera and hand tracking...')}</p>
      <p>{modelStatus}</p>
      <label className="toggleRow">
        <input
          type="checkbox"
          checked={showSkeleton}
          onChange={(e) => onSkeletonToggle(e.target.checked)}
        />
        <span>Show hand skeleton</span>
      </label>
    </div>
  )
}
