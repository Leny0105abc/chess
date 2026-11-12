import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Flame, Heart, Lightbulb, LockKeyhole, Map, Repeat2, Share2, Target, Trophy, Zap } from 'lucide-react'
import { Chess } from 'chess.js'
import Board from '../components/Board'
import { Empty, Heading, Meter } from '../components/ui'
import { afterMateCandidate, dailyPuzzle, primaryTheme, puzzleExplanation, puzzleHint, puzzleLevel, puzzleLevels, puzzleThemes, puzzles, themeName, type Puzzle } from '../data/puzzles'
import { colorName, line, play, uci, pieceNames, type InputMove } from '../chess'
import { day, puzzleRating, useProgress } from '../progress'

const modes=[
  {id:'rush',label:'Puzzle Rush',desc:'Solve a ladder of tactics before the clock runs out.',icon:Zap},
  {id:'survival',label:'Survival',desc:'Keep climbing with three lives and no time limit.',icon:Heart},
  {id:'battle',label:'Personal Battle',desc:'Race your own three-minute best score.',icon:Trophy},
  {id:'adventure',label:'Puzzle Adventure',desc:'Unlock seven stages of tactical practice.',icon:Map}
]
const stages=['Pawn Village','Knight Forest','Bishop Mountain','Rook Fortress','Queen’s Kingdom','King’s Castle','Grandmaster Arena']
export default function Puzzles({daily=false}:{daily?:boolean}) {
  const location=useLocation()
  const navigate=useNavigate()
  const [params,setParams]=useSearchParams()
  const {events}=useProgress()
  const [level,setLevel]=useState('')
  const [theme,setTheme]=useState('')
  const [page,setPage]=useState(0)
  const [length,setLength]=useState(3)
  const [stage,setStage]=useState(0)
  const solved=events.filter(event=>event.kind==='puzzle').length
  const lessons=events.filter(event=>event.kind==='lesson').length
  const id=location.pathname.split('/')[2]
  const mode=modes.find(m=>m.id===id)
  const pool=useMemo(()=>puzzles.filter(p=>(!level||puzzleLevel(p.rating)===level)&&(!theme||p.themes.includes(theme))),[level,theme])
  const puzzle=daily?dailyPuzzle():puzzles.find(p=>p.id===id)
  if(puzzle){
    const selection=params.get('theme')?puzzles.filter(p=>p.themes.includes(params.get('theme')!)):puzzles
    const index=selection.findIndex(p=>p.id===puzzle.id)
    const previous=selection[(index-1+selection.length)%selection.length]
    const next=selection[(index+1)%selection.length]
    const go=(target:Puzzle)=>navigate('/puzzles/'+target.id+(params.size?'?'+params:''))
    return <><Heading title={daily?'Daily Challenge':'Puzzle Arena'} description={daily?new Intl.DateTimeFormat('en-US',{dateStyle:'full'}).format(new Date()):'Train pattern recognition and calculate forcing moves.'} back={{to:'/puzzles',label:'Puzzle Arena'}}/>
      <Solver key={puzzle.id+String(daily)} puzzle={puzzle} daily={daily} onSkip={()=>go(next)} onPrevious={daily?undefined:()=>previous&&go(previous)} onNext={()=>go(next)}/>
      {daily&&<DailyPlan/>}
    </>
  }
  const requestedStage=Number(params.get('stage'))
  const safeStage=Number.isInteger(requestedStage)&&requestedStage>=0&&requestedStage<stages.length&&solved>=requestedStage*4&&lessons>=requestedStage?requestedStage:0
  const requestedTime=Number(params.get('time'))
  if(mode&&params.has('start'))return <Run key={location.search} mode={mode.id} title={mode.label} minutes={mode.id==='rush'&&[3,5,10].includes(requestedTime)?requestedTime:3} stage={safeStage}/>
  if(mode)return <><Heading title={mode.label} description={mode.desc} back={{to:'/puzzles',label:'Puzzle Arena'}}/><div className="card panel">{mode.id==='rush'&&<label>Session length <select value={length} onChange={e=>setLength(Number(e.target.value))}>{[3,5,10].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>}
    {mode.id==='adventure'&&<div className="grid-list">{stages.map((name,i)=><button key={name} className={'card list-card '+(stage===i?'selected-card':'')} disabled={solved<i*4||lessons<i} onClick={()=>setStage(i)}><strong>{name}</strong><span className="small muted">{i===0?'Start here':solved<i*4||lessons<i?<><LockKeyhole size={13}/> {i*4} puzzles and {i} lessons</>:'Unlocked'}</span></button>)}</div>}
    <button className="button primary" onClick={()=>setParams({start:'1',time:String(length),stage:String(stage)})}>Start {mode.label} <ArrowRight size={16}/></button></div></>
  return <><Heading title="Puzzle Arena" description="Build tactical instincts through carefully selected positions."><Link className="button primary" to="/daily"><CalendarDays size={16}/> Daily Challenge</Link></Heading>
    <div className="mode-grid">{modes.map(({id,label,desc,icon:Icon})=><Link className="card list-card" to={'/puzzles/'+id} key={id}><div className="tile-icon green"><Icon size={20}/></div><h2>{label}</h2><p>{desc}</p><span className="text-button">Start training <ChevronRight size={15}/></span></Link>)}</div>
    <h2 className="block-title">Puzzle library {puzzleRating(events)!==null&&<span className="tag">{puzzleRating(events)} training rating</span>}</h2>
    <div className="filter-bar"><select aria-label="Puzzle difficulty" value={level} onChange={e=>{setLevel(e.target.value);setPage(0)}}><option value="">All levels</option>{puzzleLevels.map(l=><option key={l}>{l}</option>)}</select><select aria-label="Puzzle theme" value={theme} onChange={e=>{setTheme(e.target.value);setPage(0)}}><option value="">All themes</option>{puzzleThemes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><span className="muted small">{pool.length} puzzles</span></div>
    {pool.length?<div className="grid-list">{pool.slice(page*12,page*12+12).map(p=><Link className="card list-card" to={'/puzzles/'+p.id+(theme?'?theme='+theme:'')} key={p.id}><span className="tag">{puzzleLevel(p.rating)} · {p.rating}</span><h2>{themeName(primaryTheme(p))}</h2><span className="small muted">{events.some(event=>event.key==='puzzle:'+p.id)?'Solved':'Puzzle '+p.id}</span><span className="text-button">Solve <ArrowRight size={14}/></span></Link>)}</div>:<Empty>No puzzles match those filters.</Empty>}
    {pool.length>12&&<div className="wrap pagination"><button className="button secondary" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span className="small muted">Page {page+1} of {Math.ceil(pool.length/12)}</span><button className="button secondary" disabled={(page+1)*12>=pool.length} onClick={()=>setPage(page+1)}>Next</button></div>}
  </>
}

function Solver({puzzle,daily=false,onPrevious,onSkip,onNext,onMistake,onSolved,timed=false}:{puzzle:Puzzle;daily?:boolean;onPrevious?:()=>void;onSkip:()=>void;onNext:()=>void;onMistake?:()=>void;onSolved?:()=>void;timed?:boolean}) {
  const {add,events,verifyPuzzle}=useProgress()
  const [fen,setFen]=useState(puzzle.fen)
  const [solution,setSolution]=useState(puzzle.moves)
  const [index,setIndex]=useState(0)
  const [flipped,setFlipped]=useState(new Chess(puzzle.fen).turn()==='b')
  const [hint,setHint]=useState(0)
  const [hintsUsed,setHintsUsed]=useState(0)
  const [mistakes,setMistakes]=useState(0)
  const [feedback,setFeedback]=useState('')
  const [done,setDone]=useState(false)
  const [solvedLine,setSolvedLine]=useState<string[]>()
  const [revealed,setRevealed]=useState(false)
  const [waiting,setWaiting]=useState(false)
  const [last,setLast]=useState<ReturnType<typeof play>>()
  const reply=useRef<number|undefined>(undefined)
  const start=useRef(Date.now())
  const side=new Chess(puzzle.fen).turn()
  const already=events.some(e=>e.key==='puzzle:'+puzzle.id)
  useEffect(()=>()=>clearTimeout(reply.current),[])
  const target=solution[index]&&!done&&!revealed&&!waiting?play(new Chess(fen),solution[index]):undefined
  const sample=line(puzzle.fen,puzzle.moves).history
  function retry(){clearTimeout(reply.current);setFen(puzzle.fen);setSolution(puzzle.moves);setIndex(0);setHint(0);setHintsUsed(0);setMistakes(0);setDone(false);setSolvedLine(undefined);setRevealed(false);setLast(undefined);setWaiting(false);setFeedback('');start.current=Date.now()}
  function finish(score:number,proof:string[]){
    setDone(true);setSolvedLine(proof);setFeedback('Puzzle solved!')
    add('puzzle',puzzle.id,themeName(primaryTheme(puzzle)),score,[puzzle.rating,Math.round((Date.now()-start.current)/1000),mistakes,hintsUsed].join('|'))
    verifyPuzzle(puzzle.id,proof)
    add('record','puzzle-rating:'+puzzle.id,'Puzzle attempt',score,String(puzzle.rating))
    if(daily)add('daily',day(),'Daily Puzzle',score)
    onSolved?.()
    if(timed)reply.current=window.setTimeout(onNext,650)
  }
  function move(input:InputMove) {
    if(waiting||done||revealed||!target)return
    const game=new Chess(fen)
    const next=play(game,input)
    let steps=solution
    if(uci(next)!==uci(target)){
      const approved=index===0?puzzle.alternatives?.find(candidate=>candidate[0]===uci(next)):undefined
      if(game.isCheckmate()&&puzzle.themes.includes('mate')) {
        setFen(game.fen());setLast(next);finish(Math.max(10,100-mistakes*15-hintsUsed*10),[...solution.slice(0,index),uci(next)]);return
      }
      if(approved){steps=approved;setSolution(steps)}
      else if(puzzle.themes.includes('mate')&&solution.length-index<=5&&afterMateCandidate(game,solution.length-index-1)){
        const alternative=[uci(next)]
        let remaining=solution.length-index-1
        while(!game.isCheckmate()&&remaining>0){
          const defender=game.turn()!==side
          const candidates=game.moves({verbose:true})
          const chosen=defender?candidates[0]:candidates.find(candidate=>{game.move(candidate);const works=afterMateCandidate(game,remaining-1);game.undo();return works})
          if(!chosen)break
          game.move(chosen);alternative.push(uci(chosen));remaining--
        }
        steps=[...solution.slice(0,index),...alternative];setSolution(steps)
        game.load(next.after)
      }else{
        setMistakes(mistakes+1);setFeedback('That move is outside the solution line. Try another continuation.');onMistake?.();return
      }
    }
    setFen(game.fen());setLast(next);setHint(0)
    if(index+1>=steps.length||game.isCheckmate()){finish(Math.max(10,100-mistakes*15-hintsUsed*10),steps);return}
    setWaiting(true);setFeedback('Correct move.')
    reply.current=window.setTimeout(()=>{
      const response=play(game,steps[index+1]);setLast(response);setFen(game.fen());setIndex(index+2);setWaiting(false)
      if(index+2>=steps.length)finish(Math.max(10,100-mistakes*15-hintsUsed*10),steps)
    },320)
  }
  const showSolution=()=>{if(!done)add('record','puzzle-rating:'+puzzle.id,'Puzzle attempt',0,String(puzzle.rating));clearTimeout(reply.current);setWaiting(false);setRevealed(true);setIndex(0);setLast(undefined);setFen(puzzle.fen)}
  function jump(n:number){setIndex(n);setLast(sample[n-1]);setFen(n?sample[n-1].after:puzzle.fen)}
  async function share(){
    const message='I solved the ChessMaster Academy daily puzzle.'
    try{if(navigator.share)await navigator.share({text:message,url:location.href});else {await navigator.clipboard.writeText(message+' '+location.href);setFeedback('Puzzle result copied.')}}catch{setFeedback('Sharing was canceled or unavailable.')}
  }
  return <div className="studio-grid"><div className="studio-board"><Board key={puzzle.id} fen={fen} onMove={!waiting&&!done&&!revealed?move:undefined} flipped={flipped} last={last} arrows={hint>=3&&target?[{from:target.from,to:target.to}]:[]} highlights={hint>=2&&target?[target.from]:[]} legal={!timed}/>
    <div className="controls"><span className="subtle-label">{colorName(side)} to move</span><span className="controls-spacer"/><button className="icon-button" aria-label="Flip board" onClick={()=>setFlipped(!flipped)}><Repeat2 size={19}/></button></div></div>
    <div className="card studio-panel">
      <div className="wrap"><span className="tag">{puzzleLevel(puzzle.rating)} · {puzzle.rating}</span>{already&&<span className="tag">Solved</span>}</div>
      <h2>{done?'Puzzle solved':revealed?'Solution replay':'Find the winning move'}</h2>
      <p>{done||revealed?puzzleExplanation(done&&solvedLine&&!revealed?{...puzzle,moves:solvedLine}:puzzle):'Look for the strongest continuation for '+colorName(side)+'.'}</p>
      {!timed&&<Meter value={(done?1:index/solution.length)*100} label="Puzzle progress"/>}
      {feedback&&<div className={'notice-box '+(feedback.startsWith('That')?'error':'')} role="status">{feedback}</div>}
      {target&&hint>0&&<div className="notice-box" aria-live="polite">{hint===1?puzzleHint(puzzle):hint===2?'Look at the '+pieceNames[target.piece]+' on '+target.from+'.':'Try '+target.san+' to '+target.to+'.'}</div>}
      {revealed&&<div className="move-grid">{sample.map((step,i)=><button className={i+1===index?'current':''} onClick={()=>jump(i+1)} key={i}>{i+1}. {step.san}</button>)}</div>}
      <div className="wrap">{!timed&&<><button className="button secondary" disabled={done||revealed||hint===3||waiting} onClick={()=>{setHint(hint+1);setHintsUsed(hintsUsed+1)}}><Lightbulb size={16}/> Hint</button><button className="button secondary" onClick={retry}>Retry</button><button className="button secondary" onClick={showSolution}>Show Solution</button></>}
        {!done&&!revealed&&<button className="button quiet" onClick={onSkip}>Skip Puzzle</button>}
        {done||revealed?<button className="button primary" onClick={onNext}>Next Puzzle <ArrowRight size={15}/></button>:null}</div>
      {!timed&&<div className="wrap">{onPrevious&&<button className="text-button" onClick={onPrevious}><ArrowLeft size={14}/> Previous Puzzle</button>}<Link className="text-button" to={'/analysis?fen='+encodeURIComponent(fen)}>Analyze Position <ArrowRight size={14}/></Link>{daily&&done&&<button className="text-button" onClick={()=>void share()}><Share2 size={14}/> Share result</button>}</div>}
      {!timed&&<a className="muted small" href={puzzle.url} target="_blank" rel="noreferrer">Source game on Lichess</a>}
    </div>
  </div>
}

function Run({mode,title,minutes,stage}:{mode:string;title:string;minutes:number;stage:number}) {
  const {add,events}=useProgress()
  const [clock,setClock]=useState(minutes*60)
  const [index,setIndex]=useState(0)
  const [score,setScore]=useState(0)
  const [errors,setErrors]=useState(0)
  const [finished,setFinished]=useState(false)
  const [run,setRun]=useState(0)
  const timer=mode==='rush'||mode==='battle'
  const limit=mode==='adventure'?5:puzzles.length
  const record=events.find(e=>e.key==='record:'+mode+(mode==='rush'?minutes:''))
  const series=useMemo(()=>puzzles.filter((p,i)=>p.rating>=(mode==='adventure'?700+stage*170:750)&&i%3===run%3),[mode,stage,run])
  const done=finished||timer&&clock===0||mode==='survival'&&errors>=3||index>=Math.min(limit,series.length)
  useEffect(()=>{
    if(!timer||done)return
    const end=Date.now()+minutes*60000
    const tick=window.setInterval(()=>setClock(Math.max(0,Math.ceil((end-Date.now())/1000))),250)
    return ()=>clearInterval(tick)
  },[run,timer,minutes,done])
  useEffect(()=>{if(done&&score>(record?.score??0))add('record',mode+(mode==='rush'?minutes:''),title+' personal record',score)},[done,score,record?.score,mode,minutes,title,add])
  return <><Heading title={title} description={mode==='adventure'?stages[stage]:undefined} back={{to:'/puzzles/'+mode,label:'Back to mode setup'}}/>
    <div className="card panel run-bar"><div className="wrap"><span className="tag"><Target size={14}/> {score} solved</span><span className="tag">{errors} mistakes</span>{timer&&<span className="tag warm"><Clock3 size={14}/> {Math.floor(clock/60)}:{String(clock%60).padStart(2,'0')}</span>}{mode==='survival'&&<span className="tag warm"><Heart size={14}/> {Math.max(0,3-errors)} lives</span>}{mode==='battle'&&<span className="tag">Personal best {record?.score??0}</span>}</div>{!done&&<button className="button secondary" onClick={()=>setFinished(true)}>End session</button>}</div>
    {done?<div className="card panel"><h2>Session complete</h2><p>You solved {score} puzzles with {errors} mistakes.</p><button className="button primary" onClick={()=>{setClock(minutes*60);setIndex(0);setScore(0);setErrors(0);setFinished(false);setRun(run+1)}}>Play again</button></div>:
      <Solver key={series[index].id+run} puzzle={series[index]} timed onSkip={()=>{setErrors(errors+1);setIndex(index+1)}} onNext={()=>setIndex(index+1)} onSolved={()=>setScore(score+1)} onMistake={()=>setErrors(errors+1)}/>}
  </>
}
function DailyPlan(){
  const {profile,events,add}=useProgress()
  const plan=profile.level==='Beginner'?[['Chess fundamentals',5,'/learn'],['Opening principles',5,'/openings'],['Tactical puzzles',10,'/puzzles'],['Endgame practice',5,'/endgames']]:profile.level==='Intermediate'?[['Opening practice',10,'/openings'],['Tactical puzzles',15,'/puzzles'],['Middlegame strategy',10,'/learn'],['Endgame practice',10,'/endgames']]:[['Opening repertoire',15,'/openings/repertoire'],['Calculation exercises',20,'/puzzles'],['Strategic analysis',15,'/analysis'],['Endgame technique',15,'/endgames'],['Game review',15,'/analysis']]
  const total=plan.reduce((sum,[,minutes])=>sum+Number(minutes),0)
  const goal=profile.dailyMinutes||total
  let assigned=0
  const schedule=plan.map(([name,minutes,path],i)=>{
    const duration=i===plan.length-1?goal-assigned:Math.round(Number(minutes)*goal/total)
    assigned+=duration
    const id='plan:'+day()+':'+profile.level+':'+i
    const logged=events.find(e=>e.key==='record:'+id)?.score
    return {name:String(name),duration,path:String(path),id,logged}
  })
  const completed=schedule.reduce((sum,item)=>sum+(item.logged??0),0)
  return <section className="card panel lesson-summary"><div className="section-title"><div className="tile-icon orange"><Flame size={19}/></div><div><h2>Today’s training plan</h2><p>{profile.level} · {completed} of {goal} minutes logged</p></div></div>
    <Meter value={completed/goal*100} label="Daily training goal"/>
    {schedule.map(item=><div className="activity-row" key={item.id}><div className="tile-icon green">{item.logged!==undefined?<Check size={16}/>:<Clock3 size={16}/>}</div><div><Link className="text-button" to={item.path}>{item.name} <ChevronRight size={15}/></Link><small>{item.duration} min</small></div><button className="button secondary" disabled={item.logged!==undefined} onClick={()=>add('record',item.id,item.name,item.duration)}>{item.logged!==undefined?'Logged':'Log practice'}</button></div>)}
    <Link className="text-button" to="/settings">Change daily goal <ArrowRight size={15}/></Link>
  </section>
}
