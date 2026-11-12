import { useCallback, useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'

export function useMovePlayback(cursor: number, length: number, showMove: (index: number) => void) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1050)
  const pause = useCallback(() => setPlaying(false), [])

  useEffect(() => {
    if (!playing || cursor >= length) return

    const timer = window.setTimeout(() => {
      const next = cursor + 1
      showMove(next)
      if (next === length) pause()
    }, speed)

    return () => window.clearTimeout(timer)
  }, [playing, cursor, length, speed, showMove, pause])

  function toggle() {
    if (playing) {
      pause()
    } else if (length > 0) {
      if (cursor === length) showMove(0)
      setPlaying(true)
    }
  }

  return { playing, speed, setSpeed, pause, toggle, disabled: length === 0 }
}

type Playback = ReturnType<typeof useMovePlayback>

export function PlaybackButton({ playback, compact = false }: { playback: Playback; compact?: boolean }) {
  const { playing, toggle, disabled } = playback
  const Icon = playing ? Pause : Play
  const label = playing ? 'Pause' : 'Play'
  const description = playing ? 'Pause playback' : 'Play all moves'

  return (
    <button
      type="button"
      className={compact ? 'icon-button active-control' : 'button primary playback-button'}
      aria-label={compact ? description : undefined}
      title={description}
      disabled={disabled}
      onClick={toggle}
    >
      <Icon size={17} aria-hidden="true" />
      {!compact && label}
    </button>
  )
}

export function PlaybackToolbar({ playback }: { playback: Playback }) {
  return (
    <div className="playback-toolbar">
      <PlaybackButton playback={playback} />
      <label className="select-label">
        Playback speed
        <select
          disabled={playback.disabled}
          value={playback.speed}
          onChange={event => playback.setSpeed(Number(event.target.value))}
        >
          <option value="1650">Slow</option>
          <option value="1050">Normal</option>
          <option value="500">Fast</option>
        </select>
      </label>
    </div>
  )
}
