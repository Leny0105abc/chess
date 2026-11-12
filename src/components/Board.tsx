import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { colorName, pieceNames, type Arrow, type InputMove } from '../chess'

const files = 'abcdefgh'
const glyphs = {w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}}
const asset = (color: string, piece: string) => '/pieces/' + color + piece.toUpperCase() + '.svg'
export function Piece({color, piece}: {color:'w'|'b';piece:keyof typeof pieceNames}) {
  const [failed,setFailed] = useState(false)
  return failed ? <span className={'glyph '+color} aria-hidden>{glyphs[color][piece]}</span> :
    <img className="piece" src={asset(color,piece)} draggable={false} alt="" onError={()=>setFailed(true)}/>
}

export default function Board({fen, onMove, flipped=false, last, arrows=[], highlights=[], compact=false, legal=true, coordinates=true, label='Chessboard', onSquare}: {
  fen:string;onMove?:(move: InputMove)=>void;flipped?:boolean;last?:Move;arrows?:Arrow[];highlights?:Square[];
  compact?:boolean;legal?:boolean;coordinates?:boolean;label?:string;onSquare?:(square:Square)=>void
}) {
  const game = useMemo(()=>new Chess(fen),[fen])
  const [selection, setSelection] = useState<{fen:string;square:Square}>()
  const [message,setMessage]=useState('')
  const [focus,setFocus] = useState(0)
  const [promotion,setPromotion] = useState<{fen:string;from:Square;to:Square}>()
  const cells = useRef<Array<HTMLButtonElement|null>>([])
  const selected = selection?.fen === fen ? selection.square : undefined
  const candidates = useMemo(()=>selected ? game.moves({square:selected,verbose:true}) : [],[game,selected])
  const squares = Array.from({length:64},(_,i)=> (files[flipped ? 7-i%8 : i%8]+(flipped ? 1+Math.floor(i/8) : 8-Math.floor(i/8))) as Square)
  const point = (square:Square) => { const i=squares.indexOf(square); return [i%8+.5,Math.floor(i/8)+.5] }
  function attempt(from:Square,to:Square) {
    if(!onMove) return false
    const moves = game.moves({square:from,verbose:true}).filter(move=>move.to===to)
    if(!moves.length){if(from!==to&&game.get(to)?.color!==game.turn())setMessage('That move is illegal.');return false}
    setMessage('')
    if(moves.some(move=>move.promotion)) setPromotion({fen,from,to})
    else {onMove({from,to});setSelection(undefined)}
    return true
  }
  function click(square:Square) {
    onSquare?.(square)
    if(!onMove) return
    if(selected===square){setSelection(undefined);return}
    if(selected && attempt(selected,square)) return
    setSelection(game.get(square)?.color===game.turn()?{fen,square}:undefined)
  }
  function navigate(event:KeyboardEvent<HTMLButtonElement>, index:number) {
    const offset = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key]
    if(offset===undefined) return
    event.preventDefault()
    const next=Math.max(0,Math.min(63,index+offset))
    setFocus(next)
    cells.current[next]?.focus()
  }
  return <div className={'board-frame'+(compact?' compact':'')} aria-label={label}>
    <div className="chessboard">
      {squares.map((square,index)=>{
        const piece=game.get(square)
        const check=piece?.type==='k' && piece.color===game.turn() && game.isCheck()
        const target=legal && candidates.some(move=>move.to===square)
        const active=onMove || onSquare
        const classes=['square',(files.indexOf(square[0])+Number(square[1]))%2?'dark':'light',selected===square?'selected':'',last?.from===square||last?.to===square?'last':'',highlights.includes(square)?'instructed':'',check?'in-check':'',target?'target':'',target&&piece?'target-piece':''].filter(Boolean).join(' ')
        const travel=last?.to===square?{ '--travel-x':(point(last.from)[0]-point(last.to)[0])*115+'%', '--travel-y':(point(last.from)[1]-point(last.to)[1])*115+'%' } as CSSProperties:undefined
        const children=<>{piece&&<Piece key={piece.color+piece.type} color={piece.color} piece={piece.type}/>}
          {coordinates&&index%8===0&&<span className="coord rank">{square[1]}</span>}
          {coordinates&&index>=56&&<span className="coord file">{square[0]}</span>}</>
        return active?<button key={square} className={classes} style={travel} aria-label={square+(piece?' '+colorName(piece.color)+' '+pieceNames[piece.type]:'')} ref={node=>{cells.current[index]=node}} tabIndex={index===focus?0:-1} onKeyDown={e=>navigate(e,index)} onClick={()=>click(square)} draggable={Boolean(onMove&&piece?.color===game.turn())} onDragStart={e=>{e.dataTransfer.setData('text/plain',square);setSelection({fen,square})}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain');if(/^[a-h][1-8]$/.test(from))attempt(from as Square,square)}}>{children}</button>:<div key={square} className={classes} style={travel} title={square}>{children}</div>
      })}
      {arrows.length>0&&<svg viewBox="0 0 8 8" className="arrows" aria-hidden>{arrows.map(({from,to,color='#e9a82d'},i)=>{
        const [x,y]=point(from),[tx,ty]=point(to)
        const angle=Math.atan2(ty-y,tx-x), ux=Math.cos(angle),uy=Math.sin(angle)
        const bx=tx-.39*ux,by=ty-.39*uy
        return <g key={i} opacity=".85"><path d={`M${x},${y} L${bx},${by}`} stroke={color} strokeWidth=".15" strokeLinecap="round"/><polygon points={`${tx},${ty} ${bx+.18*uy},${by-.18*ux} ${bx-.18*uy},${by+.18*ux}`} fill={color}/></g>
      })}</svg>}
    </div>
    {onMove&&<span className='sr-only' role='status'>{message}</span>}
    {promotion?.fen===fen&&<div className="promotion" role="dialog" aria-label="Promote pawn">
      <strong>Promote pawn</strong><div>{(['q','r','b','n'] as const).map(piece=><button key={piece} aria-label={'Promote to '+pieceNames[piece]} onClick={()=>{onMove?.({from:promotion.from,to:promotion.to,promotion:piece});setPromotion(undefined);setSelection(undefined)}}><Piece color={game.turn()} piece={piece}/></button>)}</div>
      <button className="button quiet" onClick={()=>setPromotion(undefined)}>Cancel</button>
    </div>}
  </div>
}
