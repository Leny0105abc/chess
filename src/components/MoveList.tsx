import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'

type MoveListProps = {
  moves: Move[]
  cursor: number
  jump: (index: number) => void
  labels?: Map<number, string>
  label?: string
  follow?: boolean
}

export default function MoveList({ moves, cursor, jump, labels, label = 'Move history', follow }: MoveListProps) {
  const list = useRef<HTMLDivElement>(null)
  const currentMove = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const container = list.current
    if (!follow || !container) return
    if (cursor === 0) {
      container.scrollTop = 0
      return
    }

    const move = currentMove.current?.getBoundingClientRect()
    if (!move) return
    const bounds = container.getBoundingClientRect()
    if (move.top < bounds.top) container.scrollTop += move.top - bounds.top
    else if (move.bottom > bounds.bottom) container.scrollTop += move.bottom - bounds.bottom
  }, [cursor, follow, moves])

  return (
    <div className="move-grid" aria-label={label} ref={list}>
      {moves.length === 0 && <span className="small muted">Moves will appear here.</span>}
      {moves.map((move, index) => {
        const ply = index + 1
        const current = ply === cursor
        return (
          <button
            key={ply}
            className={current ? 'current' : ''}
            aria-current={current ? 'step' : undefined}
            ref={current ? currentMove : undefined}
            onClick={() => jump(ply)}
          >
            <span>{move.before.split(' ').at(-1)}{move.color === 'w' ? '.' : '…'}</span> {move.san}
            {labels?.has(ply) && <small className="move-label">{labels.get(ply)}</small>}
          </button>
        )
      })}
    </div>
  )
}
