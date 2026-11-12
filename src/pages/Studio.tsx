import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bot, Copy, Download, Flag, Lightbulb, RotateCcw, Upload } from 'lucide-react'
import type { Move } from 'chess.js'
import Board,{ Piece } from '../components/Board'
import MoveList from '../components/MoveList'
import { PlaybackButton, PlaybackToolbar, useMovePlayback } from '../components/MovePlayback'
import { Controls, downloadFile, fullscreen, Heading } from '../components/ui'
import { colorName, initialFen, line, moveNote, parsePgn, pieceNames, play, result, uci, validPosition, type InputMove } from '../chess'
import { classification, evaluate, numeric, scoreLabel, type Evaluation } from '../engine'
import { useProgress } from '../progress'

const strengths=['Absolute Beginner','Beginner','Casual Player','Intermediate','Club Player','Advanced','Expert','Master']
const timeControls=[['1 minute',60,0],['3 minutes',180,0],['5 minutes',300,0],['10 minutes',600,0],['15 minutes',900,0],['15 minutes + 10 seconds',900,10],['30 minutes',1800,0],['Unlimited',0,0]] as const
const startingTimes=(id:number)=>[timeControls[id][1]*1000,timeControls[id][1]*1000] as [number,number]
const clock=(ms:number)=>Math.floor(Math.ceil(ms/1000)/60)+':'+String(Math.ceil(ms/1000)%60).padStart(2,'0')
type GameState={fen:string;moves:string[];cursor:number;flipped:boolean}
const defaults:GameState={fen:initialFen,moves:[],cursor:0,flipped:false}

export default function Studio({mode}:{mode:'play'|'analysis'}){
  const [params]=useSearchParams()
  const start=useMemo(()=>{try{return validPosition(params.get('fen')??initialFen)}catch{return initialFen}},[params])
  return mode==='play'?<Computer key={start+params.get('color')} start={start} initialColor={params.get('color')==='Black'?'b':'w'}/>:<Analysis key={start} start={start}/>
}
function useGame(start:string) {
  const [state,set]=useState({...defaults,fen:start})
  const game=useMemo(()=>line(state.fen,state.moves.slice(0,state.cursor)).game,[state.fen,state.moves,state.cursor])
  const history=useMemo(()=>line(state.fen,state.moves).history,[state.fen,state.moves])
  const board=useRef<HTMLDivElement>(null)
  const jump=useCallback((cursor:number)=>set(s=>({...s,cursor})),[])
  const flip=()=>set(s=>({...s,flipped:!s.flipped}))
  const add=(move:Move)=>set(s=>({...s,moves:[...s.moves.slice(0,s.cursor),uci(move)],cursor:s.cursor+1}))
  return {state,set,game,history,jump,flip,add,board,last:history[state.cursor-1]}
}
function Computer({start,initialColor}:{start:string;initialColor:'w'|'b'}) {
  const training=useProgress()
  const {state,set,game,history,board,jump,flip,add,last}=useGame(start)
  const [source,setSource]=useState(start===initialFen?'':start)
  const [choice,setChoice]=useState<string>(initialColor)
  const [side,setSide]=useState<'w'|'b'>(initialColor)
  const [difficulty,setDifficulty]=useState(2)
  const [time,setTime]=useState(7)
  const [activeTime,setActiveTime]=useState(7)
  const [level,setLevel]=useState(2)
  const [started,setStarted]=useState(false)
  const [clockStart,setClockStart]=useState(0)
  const [tick,setTick]=useState(Date.now())
  const [remaining,setRemaining]=useState(startingTimes(7))
  const [finished,setFinished]=useState('')
  const [error,setError]=useState('')
  const [retry,setRetry]=useState(0)
  const [hints,setHints]=useState(0)
  const [hintMove,setHintMove]=useState<Move>()
  const [hintPending,setHintPending]=useState(false)
  const [coach,setCoach]=useState('Simple')
  const hintRequest=useRef<AbortController|null>(null)
  const completed=useRef('')
  const turn=game.turn()
  const index=turn==='w'?0:1
  const clockActive=started&&timeControls[activeTime][1]>0
  const live=state.cursor===state.moves.length
  const dead=Boolean(finished)||game.isGameOver()
  const actual=clockActive&&live&&!dead?Math.max(0,remaining[index]-Math.max(0,tick-clockStart)):remaining[index]
  const computer=started&&live&&!dead&&turn!==side&&(!clockActive||actual>0)
  useEffect(()=>()=>hintRequest.current?.abort(),[])
  useEffect(()=>{
    if(!clockActive||dead||!live)return
    const id=window.setInterval(()=>setTick(Date.now()),125)
    return ()=>clearInterval(id)
  },[clockActive,dead,live])
  useEffect(()=>{if(clockActive&&live&&!dead&&actual<=0)setFinished(colorName(turn==='w'?'b':'w')+' wins on time')},[clockActive,live,dead,actual,turn])
  function playMove(move:Move) {
    const now=Date.now()
    if(clockActive){
      const left=remaining[index]-(now-clockStart)
      if(left<=0){setFinished(colorName(turn==='w'?'b':'w')+' wins on time');return}
      setRemaining(prev=>prev.map((ms,i)=>i===index?left+timeControls[activeTime][2]*1000:ms) as [number,number])
    }
    hintRequest.current?.abort()
    setHintMove(undefined);setHints(0);setHintPending(false);setTick(now);setClockStart(now);add(move)
    if(training.profile.sound)playSound()
  }
  useEffect(()=>{
    if(!computer)return
    const controller=new AbortController()
    setError('')
    void evaluate({fen:state.fen,moves:state.moves,depth:[3,4,5,7,9,11,13,15][level],skill:[0,0,2,5,8,12,17,20][level],signal:controller.signal}).then(data=>{
      if(controller.signal.aborted||!data[0])return
      const engineGame=line(state.fen,state.moves).game
      const possible=engineGame.moves({verbose:true})
      const selected=level===0?possible[Math.floor(Math.random()*possible.length)]:level===1&&Math.random()<.32?possible[Math.floor(Math.random()*possible.length)]:play(engineGame,data[0].best)
      if(selected)playMove(selected)
    }).catch(reason=>{if(!controller.signal.aborted)setError(String(reason.message??reason))})
    return ()=>controller.abort()
  // Clock ticks must not restart the worker. Each turn captures its starting clock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[computer,state.fen,state.moves,level,retry])
  useEffect(()=>{
    if(!game.isCheckmate()||!started||turn===side||!live)return
    const id=state.fen+'|'+state.moves.join(' ')
    if(completed.current===id)return
    completed.current=id
    training.add('game','engine-'+level,'Defeated '+strengths[level])
  },[game,turn,side,started,live,state.fen,state.moves,level,training])
  function reset(){
    try{
      const fen=source.trim()?validPosition(source.trim()):initialFen
      const color=choice==='random'?(Math.random()<.5?'w':'b'):choice as 'w'|'b'
      const now=Date.now()
      hintRequest.current?.abort();setSide(color);setLevel(difficulty);setActiveTime(time);setRemaining(startingTimes(time));setTick(now);setClockStart(now)
      set({...defaults,fen,flipped:color==='b'});setFinished('');setStarted(true);setError('');setHints(0);setHintMove(undefined);setHintPending(false)
    }catch(reason){setError((reason as Error).message)}
  }
  async function hint(){
    if(hintPending||dead||!live)return
    if(hintMove){setHints(n=>Math.min(4,n+1));return}
    setHintPending(true);setError('')
    const request=new AbortController()
    hintRequest.current=request
    try{
      const [best]=await evaluate({fen:state.fen,moves:state.moves,depth:10,signal:request.signal})
      if(best&&!request.signal.aborted){setHintMove(play(line(state.fen,state.moves).game,best.best));setHints(1)}
    }catch(reason){if(!request.signal.aborted)setError((reason as Error).message)}
    finally{if(!request.signal.aborted)setHintPending(false)}
  }
  const showHint=hintMove&&hints>0?coachHint(hintMove,hints,coach):''
  return <><Heading title="Play vs Computer" description="Choose a training partner and practice at your own pace."/>
    <div className="studio-grid"><div className="studio-board" ref={board}>
      <div className="player-row"><span className="wrap"><Bot size={18}/> Stockfish · {strengths[started?level:difficulty]}</span>{clockActive&&<b>{clock(turn!==side?actual:remaining[side==='w'?1:0])}</b>}</div>
      <Board fen={game.fen()} last={last} flipped={state.flipped} onMove={started&&live&&!dead&&!computer?input=>playMove(play(line(state.fen,state.moves).game,input)):undefined} highlights={hintMove&&hints>=2?[hintMove.from]:[]} arrows={hintMove&&hints>=3?[{from:hintMove.from,to:hintMove.to}]:[]}/>
      <div className="player-row"><span>{training.profile.name||'You'} · {colorName(side)}</span>{clockActive&&<b>{clock(turn===side?actual:remaining[side==='w'?0:1])}</b>}</div>
      <Controls cursor={state.cursor} max={history.length} change={n=>{if(!clockActive||dead)jump(n)}} flip={flip} full={()=>void fullscreen(board.current)}/>
    </div><div className="card studio-panel">
      <div className="subtle-label">Computer opponent</div><h2>{finished||result(game)}</h2>
      <div className="form-grid">
        <label>Difficulty <select value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))}>{strengths.map((value,i)=><option key={value} value={i}>{value}</option>)}</select></label>
        <label>Play as <select value={choice} onChange={e=>setChoice(e.target.value)}><option value="w">White</option><option value="b">Black</option><option value="random">Random color</option></select></label>
        <label>Time control <select value={time} onChange={e=>setTime(Number(e.target.value))}>{timeControls.map(([label],i)=><option key={label} value={i}>{label}</option>)}</select></label>
        <label>Custom FEN (optional) <input value={source} onChange={e=>setSource(e.target.value)} placeholder="Standard starting position" maxLength={150}/></label>
      </div><button className="button primary" onClick={reset}><RotateCcw size={16}/> {started?'Start new game':'Start game'}</button>
      {started&&<><MoveList moves={history} cursor={state.cursor} jump={n=>{if(!clockActive||dead)jump(n)}}/><Captured history={history.slice(0,state.cursor)}/>
        {computer&&!error&&<p role="status">Stockfish is thinking…</p>}
        {error&&<div className="notice-box error">{error} {computer&&<button className="text-button" onClick={()=>setRetry(retry+1)}>Retry engine</button>}</div>}
        <label className="select-label">Coach detail <select value={coach} onChange={e=>setCoach(e.target.value)}>{['Simple','Detailed','Advanced'].map(label=><option key={label}>{label}</option>)}</select></label>
        <div className="wrap"><button className="button secondary" disabled={dead||computer||hintPending||hints>=4||!live} onClick={()=>void hint()}><Lightbulb size={15}/> {hintPending?'Calculating…':'Get Hint'}</button>
          <button className="button secondary" disabled={dead} onClick={()=>{hintRequest.current?.abort();setHintPending(false);setFinished(colorName(side)+' resigned')}}><Flag size={15}/> Resign</button>
          <button className="button secondary" onClick={()=>downloadFile('academy-game.pgn',line(state.fen,state.moves).game.pgn())}><Download size={15}/> PGN</button></div>
        {showHint&&<div className="notice-box" role="status">{showHint}</div>}
      </>}
      {!started&&error&&<div className="notice-box error">{error}</div>}
      <small className="muted">Difficulty levels describe training settings.</small>
    </div></div>
  </>
}

function coachHint(move:Move,level:number,detail:string){
  if(level===1)return move.san.includes('#')?'Look for a mating pattern.':move.san.includes('+')?'Look for a forcing check.':move.captured?'Look for a capture that improves your position.':'Look for a move that improves piece activity or central control.'
  if(level===2)return 'Consider the '+pieceNames[move.piece]+' on '+move.from+'.'
  if(level===3)return 'Look at the highlighted destination '+move.to+'.'
  return 'Play '+move.san+'. '+moveNote(move,0)+(detail==='Advanced'?' Compare the resulting position for material balance, king safety, and opponent counterplay.':detail==='Detailed'?' Check how the move changes the opponent’s available replies.':'')
}
function playSound(){
  try{
    const audio=new AudioContext()
    const oscillator=audio.createOscillator()
    const gain=audio.createGain()
    oscillator.frequency.value=325;gain.gain.value=.06;oscillator.connect(gain);gain.connect(audio.destination)
    oscillator.start();gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);oscillator.stop(audio.currentTime+.1)
    oscillator.onended=()=>void audio.close()
  }catch{/* a browser may disable audio */}
}
function Captured({history}:{history:Move[]}){
  const captures=history.filter(move=>move.captured)
  return captures.length>0?<div className="captured" aria-label="Captured pieces">{captures.map((move,i)=><span key={i} title={pieceNames[move.captured!]}><Piece color={move.color==='w'?'b':'w'} piece={move.captured!}/></span>)}</div>:null
}

function Analysis({start}:{start:string}){
  const {session}=useProgress()
  const {state,set,game,history,board,jump,flip,add,last}=useGame(start)
  const [input,setInput]=useState(start===initialFen?'':start)
  const [status,setStatus]=useState('')
  const [engine,setEngine]=useState<Evaluation[]>([])
  const [depth,setDepth]=useState(10)
  const [running,setRunning]=useState(false)
  const [annotations,setAnnotations]=useState<Record<string,string>>({})
  const [graph,setGraph]=useState<number[]>([])
  const [labels,setLabels]=useState(new Map<number,string>())
  const [pgnHeader,setPgnHeader]=useState<Record<string,string>>({})
  const [review,setReview]=useState(false)
  const [branches,setBranches]=useState<{id:number;moves:string[]}[]>([])
  const task=useRef<AbortController|null>(null)
  const savedKey='cma-analysis:'+(session?.user.id??'guest')
  const fen=game.fen()
  const factor=game.turn()==='w'?1:-1
  useEffect(()=>()=>task.current?.abort(),[])
  const cancel=useCallback(()=>{task.current?.abort();setRunning(false);setReview(false)},[])
  const showMove=useCallback((index:number)=>{
    cancel()
    setEngine([])
    setStatus('')
    jump(index)
  },[cancel,jump])
  const playback=useMovePlayback(state.cursor,history.length,showMove)

  function jumpTo(index:number){
    playback.pause()
    showMove(index)
  }
  function load(value:string,type:'fen'|'pgn'){
    playback.pause()
    try{
      cancel();setEngine([]);setGraph([]);setLabels(new Map());setBranches([])
      if(type==='fen'){
        set({...defaults,fen:validPosition(value.trim())});setAnnotations({});setPgnHeader({})
      }else{
        const parsed=parsePgn(value.trim())
        set({...defaults,fen:parsed.fen,moves:parsed.moves})
        setAnnotations(Object.fromEntries(parsed.comments.map(c=>[c.fen,c.comment])));setPgnHeader(parsed.headers)
      }
      setStatus(type.toUpperCase()+' loaded.')
    }catch(reason){setStatus((reason as Error).message)}
  }
  async function inspect(whole=false){
    playback.pause()
    cancel();setRunning(true);setReview(whole);setStatus('');setEngine([])
    const request=new AbortController()
    task.current=request
    try{
      if(!whole){setEngine(await evaluate({fen:state.fen,moves:state.moves.slice(0,state.cursor),depth,count:3,signal:request.signal}));return}
      const values:number[]=[]
      const tags=new Map<number,string>()
      for(let i=0;i<=state.moves.length;i++){
        const p=line(state.fen,state.moves.slice(0,i)).game
        setStatus('Reviewing position '+(i+1)+' of '+(state.moves.length+1))
        const [data]=p.isGameOver()?[]:await evaluate({fen:state.fen,moves:state.moves.slice(0,i),depth:Math.min(depth,9),signal:request.signal})
        values.push((p.isCheckmate()?-10000:numeric(data))*(p.turn()==='w'?1:-1))
        if(i>0){
          const mover=history[i-1].color==='w'?1:-1
          tags.set(i,classification(Math.max(0,(values[i-1]-values[i])*mover)))
        }
        setGraph([...values]);setLabels(new Map(tags))
      }
      setStatus('Game review complete.')
    }catch(reason){if(!request.signal.aborted)setStatus((reason as Error).message)}
    finally{if(!request.signal.aborted){setRunning(false);setReview(false)}}
  }
  function makeMove(inputMove:InputMove){
    playback.pause()
    cancel()
    if(state.cursor<state.moves.length)setBranches(prev=>[...prev,{id:Date.now(),moves:state.moves}])
    add(play(line(state.fen,state.moves.slice(0,state.cursor)).game,inputMove));setEngine([]);setGraph([]);setLabels(new Map());setStatus('')
  }
  function annotatedPgn(){
    const parsed=line(state.fen,[])
    for(const [key,value] of Object.entries(pgnHeader))if(!['SetUp','FEN'].includes(key))parsed.game.setHeader(key,value)
    if(annotations[parsed.game.fen()])parsed.game.setComment(annotations[parsed.game.fen()].replace(/[{}]/g,''))
    state.moves.forEach(move=>{play(parsed.game,move);const note=annotations[parsed.game.fen()];if(note)parsed.game.setComment(note.replace(/[{}]/g,''))})
    return parsed.game.pgn()
  }
  function saveAnalysis(){
    try{localStorage.setItem(savedKey,annotatedPgn());setStatus('Analysis saved on this device.')}
    catch{setStatus('This browser could not save the analysis.')}
  }
  function restoreAnalysis(){
    try{const pgn=localStorage.getItem(savedKey);if(pgn){setInput(pgn);load(pgn,'pgn')}else setStatus('No analysis has been saved on this device.')}
    catch{setStatus('This browser could not load the saved analysis.')}
  }
  function openEngineLine(variation:Evaluation){
    playback.pause()
    const continuation=variation.pv.slice(0,12)
    line(fen,continuation)
    if(state.cursor<state.moves.length)setBranches(prev=>[...prev.slice(-19),{id:Date.now(),moves:state.moves}])
    set(previous=>({...previous,moves:[...previous.moves.slice(0,previous.cursor),...continuation]}))
    setEngine([]);setGraph([]);setLabels(new Map());setStatus('Engine continuation added to the move list.')
  }
  const good=engine[0]
  const perc=good?Math.max(3,Math.min(97,50+numeric(good)*factor/20)):50
  const turning=[...labels].filter(([,label])=>label==='Mistake'||label==='Blunder')
  return <><Heading title="Game Analysis" description="Review moves, compare Stockfish lines, and save your annotations."/>
    <div className="studio-grid"><div className="studio-board" ref={board}><div className="eval-bar" aria-label="White evaluation"><i style={{width:perc+'%'}}/><b>{good?scoreLabel(good,factor):'—'}</b></div>
      <Board fen={fen} last={last} flipped={state.flipped} onMove={game.isGameOver()?undefined:makeMove} arrows={good?[{from:good.best.slice(0,2),to:good.best.slice(2,4)} as {from:Move['from'];to:Move['to']}]:[]}/>
      <Controls cursor={state.cursor} max={history.length} change={jumpTo} flip={flip} full={()=>void fullscreen(board.current)}>
        <PlaybackButton playback={playback} compact/>
      </Controls>
      {graph.length>1&&<div className="card panel"><h3>Evaluation graph</h3><svg className="evaluation-graph" viewBox="0 0 400 100" role="img" aria-label="White advantage by half-move"><path d="M0 50 H400" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="#5a9c73" strokeWidth="2.5" points={graph.map((value,i)=>400*i/Math.max(history.length,1)+','+(50-Math.max(-49,Math.min(49,value/12)))).join(' ')}/></svg><p>Higher points favor White.</p></div>}
    </div><div className="card studio-panel"><h2>{result(game)}</h2>
      <label className="select-label">Paste PGN or FEN <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="1. e4 e5 2. Nf3 Nc6" maxLength={128000}/></label>
      <div className="wrap"><button className="button secondary" disabled={!input.trim()} onClick={()=>load(input,'pgn')}>Load PGN</button><button className="button secondary" disabled={!input.trim()} onClick={()=>load(input,'fen')}>Load FEN</button>
      <label className="button secondary upload"><Upload size={15}/> Upload PGN<input type="file" accept=".pgn,text/plain" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>128000){setStatus('PGN must be smaller than 128 KB.');return}void file.text().then(value=>{setInput(value);load(value,'pgn')});e.target.value=''}}/></label></div>
      <PlaybackToolbar playback={playback}/>
      <MoveList moves={history} cursor={state.cursor} jump={jumpTo} labels={labels} follow/>
      {branches.length>0&&<label className="select-label">Saved branches <select value="" onChange={e=>{const b=branches.find(x=>String(x.id)===e.target.value);if(b){playback.pause();setBranches(prev=>[...prev.filter(x=>x.id!==b.id),{id:Date.now(),moves:state.moves}]);set(s=>({...s,moves:b.moves,cursor:Math.min(s.cursor,b.moves.length)}));setEngine([]);setGraph([]);setLabels(new Map());cancel()}}}><option value="">Switch continuation</option>{branches.map((b,i)=><option key={b.id} value={b.id}>Branch {i+1} · {b.moves.length} plies</option>)}</select></label>}
      <label className="select-label">Position annotation <textarea value={annotations[fen]??''} maxLength={2000} onChange={e=>setAnnotations({...annotations,[fen]:e.target.value})}/></label>
      <div className="wrap"><button className="button secondary" onClick={()=>downloadFile('academy-analysis.pgn',annotatedPgn())}><Download size={15}/> Annotated PGN</button><button className="button secondary" onClick={()=>void navigator.clipboard.writeText(fen).then(()=>setStatus('FEN copied.'),()=>setStatus(fen))}><Copy size={15}/> Copy FEN</button></div>
      <div className="wrap"><button className="button secondary" onClick={saveAnalysis}>Save analysis</button><button className="button secondary" onClick={restoreAnalysis}>Load saved analysis</button></div>
      <label className="select-label">Engine depth <select value={depth} onChange={e=>setDepth(Number(e.target.value))}>{[7,10,12,15].map(d=><option key={d}>{d}</option>)}</select></label>
      <div className="wrap"><button className="button primary" disabled={running||game.isGameOver()} onClick={()=>void inspect()}>Evaluate Position</button><button className="button secondary" disabled={running||!history.length} onClick={()=>void inspect(true)}>Review Game</button>{running&&<button className="button secondary" onClick={cancel}>Cancel</button>}</div>
      {running&&!review&&<p role="status">Stockfish is evaluating…</p>}
      {status&&<div className="notice-box" role="status">{status}</div>}
      {engine.map((entry,i)=>{
        const san=line(fen,entry.pv.slice(0,7)).history.map(move=>move.san).join(' ')
        return <div className="notice-box" key={i}><strong>{scoreLabel(entry,factor)}</strong> · {san}<br/><small>Depth {entry.depth}{i===0?' · Best move':''}</small><br/><button className="text-button" onClick={()=>openEngineLine(entry)}>Explore variation <ArrowRight size={14}/></button></div>
      })}
      {turning.length>0&&<div className="form-grid"><h3>Turning points</h3>{turning.slice(0,8).map(([i,label])=><button className="button secondary" key={i} onClick={()=>jumpTo(i-1)}>{history[i-1].san} · {label} <ArrowRight size={14}/></button>)}<Link className="text-button" to="/puzzles">Practice tactical alternatives</Link></div>}
    </div></div>
  </>
}
