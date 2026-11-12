import { useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { initialFen, line, moveNote, result, type Arrow } from '../chess'
import Board from './Board'
import MoveList from './MoveList'
import { PlaybackButton, PlaybackToolbar, useMovePlayback } from './MovePlayback'
import { Controls, fullscreen, Meter } from './ui'

export default function Replay({fen=initialFen,moves,notes=[],title,summary,initial=0,showArrows=true,extra,positionActions}: {
  fen?:string;moves:string[];notes?:string[];title?:string;summary?:string;initial?:number;showArrows?:boolean;extra?:React.ReactNode;positionActions?:(fen:string,pause:()=>void)=>React.ReactNode
}) {
  const history=useMemo(()=>line(fen,moves).history,[fen,moves])
  const [cursor,setCursor]=useState(initial)
  const [flipped,setFlipped]=useState(false)
  const playback=useMovePlayback(cursor,history.length,setCursor)
  const board=useRef<HTMLDivElement>(null)
  const move=history[cursor-1]
  const arrows:Arrow[]=move&&showArrows?[{from:move.from,to:move.to}]:[]
  const jump=(n:number)=>{playback.pause();setCursor(n)}
  const game=useMemo(()=>line(fen,moves.slice(0,cursor)).game,[fen,moves,cursor])
  return <section className="studio-grid">
    <div className="studio-board" ref={board}><Board fen={game.fen()} last={move} flipped={flipped} arrows={arrows} highlights={move?[move.from,move.to]:[]}/><Controls cursor={cursor} max={history.length} change={jump} flip={()=>setFlipped(!flipped)} full={()=>void fullscreen(board.current)}>
      <PlaybackButton playback={playback} compact/>
    </Controls></div>
    <div className="card studio-panel">
      <div className="subtle-label">{result(game)}</div>
      <h2>{move?move.san:title??'Starting position'}</h2>
      <p className="explanation" aria-live="polite">{move?notes[cursor-1]??moveNote(move,cursor-1):summary??'Choose a move or play the line to study the position.'}</p>
      <PlaybackToolbar playback={playback}/>
      <Meter label="Replay progress" value={history.length?cursor/history.length*100:0}/>
      <div className="between small muted"><span>{cursor} / {history.length} half-moves</span><button className="text-button" onClick={()=>jump(0)}><RotateCcw size={14}/> Restart</button></div>
      <MoveList moves={history} cursor={cursor} jump={jump} label="Move list" follow/>
      {positionActions?.(game.fen(),playback.pause)}
      {extra}
    </div>
  </section>
}
