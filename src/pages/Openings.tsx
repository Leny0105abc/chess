import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Bookmark, Check, ChevronRight, Download, GitBranch, Lightbulb, Repeat2, Shuffle, Upload } from 'lucide-react'
import Board from '../components/Board'
import Replay from '../components/Replay'
import { downloadFile, Empty, Heading, Meter } from '../components/ui'
import { initialFen, line, moveNote, parsePgn, play, uci, type InputMove } from '../chess'
import { evaluate, scoreLabel } from '../engine'
import { openingFamilies, openingNotes, type Opening, type Variation } from '../data/openings'
import { type RepertoireEntry, useProgress } from '../progress'

const categories=['Open Games','Semi-Open Games','Closed Games','Indian Defenses','Flank Openings']
const colorChoices=['White','Black'] as const
const practiceModes=['Guided','Practice','Examination','Random variation'] as const
type Mode=typeof practiceModes[number]
const keyOf=(o:Opening,v:Variation)=>o.id+'/'+v.id
export default function Openings(){
  const location=useLocation()
  const [params]=useSearchParams()
  const parts=location.pathname.split('/')
  const opening=openingFamilies.find(f=>f.id===parts[2])
  const variation=opening?.variations.find(v=>v.id===parts[3])??opening?.variations[0]
  if(parts[2]==='repertoire')return <Repertoire id={parts[3]}/>
  if(opening&&variation){
    if(params.has('practice')){
      const side=params.get('color')==='Black'?'Black':'White'
      return <Trainer key={keyOf(opening,variation)+location.search} name={opening.name+' · '+variation.name} id={keyOf(opening,variation)} fen={initialFen} moves={variation.moves} notes={openingNotes(opening,variation)} initialSide={side} back={'/openings/'+keyOf(opening,variation)}/>
    }
    return <OpeningDetail key={keyOf(opening,variation)} opening={opening} variation={variation}/>
  }
  return <OpeningLibrary/>
}
function OpeningLibrary(){
  const {events,entries}=useProgress()
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('')
  const [difficulty,setDifficulty]=useState('')
  const visible=openingFamilies.filter(o=>(!category||o.category===category)&&(!difficulty||o.level===difficulty)&&[o.name,...o.variations.flatMap(v=>[v.name,v.eco??''])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  const review=events.filter(e=>e.kind==='opening').filter(e=>new Date(e.at).getTime()+Math.max(1,Math.round(e.score/20))*86_400_000<Date.now()).sort((a,b)=>a.score-b.score)[0]
  return <><Heading title="Chess Openings" description="Study the first ten moves and understand the positions they lead to."><Link className="button primary" to="/openings/repertoire"><Bookmark size={16}/> My repertoire ({entries.length})</Link></Heading>
    {review&&<div className="notice-box course-banner"><Link className="text-button" to={'/openings/'+(review.key.slice(8).includes('/')?review.key.slice(8):'repertoire/'+review.key.slice(8))+'?practice=1'}>Due for review · {review.title} <ArrowRight size={14}/></Link></div>}
    <div className="filter-bar"><input aria-label="Search opening library" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by opening, variation, or ECO code"/>
      <select aria-label="Opening category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(category=><option key={category}>{category}</option>)}</select>
      <select aria-label="Opening difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="">All levels</option>{['Beginner','Intermediate','Advanced'].map(level=><option key={level}>{level}</option>)}</select></div>
    {visible.length?<div className="grid-list">{visible.map(o=><Link className="card list-card" key={o.id} to={'/openings/'+o.id+'/'+o.variations[0].id}>
      <div className="between" style={{width:'100%'}}><div className="tile-icon green"><BookOpen size={19}/></div><span className="tag">{o.level}</span></div>
      <h2>{o.name}</h2><p>{o.white}</p><span className="small muted">{o.category} · {o.variations.length} variations</span><span className="text-button">Explore opening <ArrowRight size={15}/></span>
    </Link>)}</div>:<Empty>No openings match your search.</Empty>}
  </>
}
function OpeningDetail({opening:o,variation:v}:{opening:Opening;variation:Variation}){
  const {save,remove,entries}=useProgress()
  const [side,setSide]=useState<'White'|'Black'>('White')
  const [choice,setChoice]=useState('')
  const [evalStatus,setEvalStatus]=useState('')
  const [evalFen,setEvalFen]=useState('')
  const [busy,setBusy]=useState(false)
  const engine=useRef<AbortController|null>(null)
  useEffect(()=>()=>engine.current?.abort(),[])
  const notes=useMemo(()=>openingNotes(o,v),[o,v])
  const route='/openings/'+keyOf(o,v)
  const id='opening-'+o.id+'-'+v.id+'-'+side.toLowerCase()
  const existing=entries.find(entry=>entry.id===id)
  const position=useMemo(()=>line(initialFen,v.moves).game,[v.moves])
  const stem=v.moves.slice(0,4).join(' ')
  const wrong=o.variations.find(x=>x.id!==v.id)?.moves.find((m,i)=>v.moves[i]!==m)
  const diff=o.variations.find(x=>x.id!==v.id)?.moves.findIndex((m,i)=>v.moves[i]!==m)??-1
  const quizPly=diff>=0?diff:2
  const answer=v.moves[quizPly]
  async function inspect(fen:string){
    const analysisPosition=line(fen,[]).game
    if(analysisPosition.isGameOver()){setEvalFen(fen);setEvalStatus('This is a final game position.');return}
    const controller=new AbortController()
    engine.current=controller;setBusy(true);setEvalStatus('');setEvalFen(fen)
    try{
      const [entry]=await evaluate({fen,depth:10,signal:controller.signal})
      if(entry&&!controller.signal.aborted)setEvalStatus(scoreLabel(entry,analysisPosition.turn()==='w'?1:-1)+' for White. Best continuation: '+line(fen,entry.pv.slice(0,5)).history.map(move=>move.san).join(' ')+'.')
    }catch(reason){if(!controller.signal.aborted)setEvalStatus((reason as Error).message)}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  return <><Heading title={o.name} description={v.name+' · '+o.category+' · '+o.level+(v.eco?' · '+v.eco:'')} back={{to:'/openings',label:'Chess Openings'}}><Link className="button primary" to={route+'?practice=1&color='+side}>Practice This Opening <ArrowRight size={16}/></Link></Heading>
    <div className="filter-bar"><div className="tabs variation-tabs" aria-label="Opening variations">{o.variations.map(vv=><Link className={'tab '+(v.id===vv.id?'active':'')} to={'/openings/'+keyOf(o,vv)} key={vv.id}>{vv.name}</Link>)}</div></div>
    <Replay fen={initialFen} moves={v.moves} notes={notes} positionActions={(fen,pause)=><>
      <button className="button secondary" disabled={busy} onClick={()=>{pause();void inspect(fen)}}>
        {busy?'Evaluating…':'Evaluate position'}
      </button>
      {evalStatus&&evalFen===fen&&<div className="notice-box" role="status">{evalStatus}</div>}
    </>} summary={'Starting sequence: '+stem+'. '+o.white} extra={<><div className="wrap"><select aria-label="Repertoire color" value={side} onChange={e=>setSide(e.target.value as typeof side)}>{colorChoices.map(color=><option key={color}>{color}</option>)}</select><button className="button secondary" onClick={()=>existing?remove(id):save({id,name:o.name+' · '+v.name,color:side,notes:'',fen:initialFen,moves:v.moves,openingPath:keyOf(o,v)})}>{existing?<Check size={15}/>:<Bookmark size={15}/>} {existing?'Saved · remove':'Save to repertoire'}</button></div>
      <div className="wrap"><Link className="text-button" to={'/play?fen='+encodeURIComponent(position.fen())}>Play this position <ArrowRight size={14}/></Link></div></>}/>
    <div className="dashboard-grid below"><section className="card panel"><h2>Plans for both sides</h2><h3>White</h3><p>{o.white}</p><h3>Black</h3><p>{o.black}</p>{(o.gambit||/gambit/i.test(v.name))&&<p>A gambit offers material for development, initiative, or positional compensation. {o.speculative?'This is a sharp, speculative choice against accurate defense.':'Calculate whether the resulting activity justifies the offer.'}</p>}</section>
      <section className="card panel"><h2>What to watch for</h2><p>{o.mistake}</p>{v.id==='opera-game'&&<p>Model game · Paul Morphy versus the Duke of Brunswick and Count Isouard, Paris, 1858. Watch how White turns a development lead into control of the d-file.</p>}<h3>Practice from the tabiya</h3><p>Replay the first point where this line differs from the other variations. Name the intended pawn break, then play the final position against Stockfish.</p>{v.recordedPlies<v.moves.length&&<small className="muted">The last {v.moves.length-v.recordedPlies} half-moves are a Stockfish practice continuation.</small>}{v.source&&<small className="muted">Opening source: {v.source} · Lichess chess-openings (CC0)</small>}</section></div>
    <section className="card panel lesson-summary"><h2>Opening quiz</h2><p>In this variation, what is the recorded move after {quizPly?v.moves.slice(0,quizPly).join(' '):'the starting position'}?</p><div className="wrap">{[...new Set([answer,wrong&&wrong!==answer?wrong:answer==='h3'?'a3':'h3'])].map(option=><button key={option} className="button secondary" onClick={()=>setChoice(option)}>{option}</button>)}</div>{choice&&<div className="notice-box" role="status">{choice===answer?'Correct. ':'Compare the variation before trying again. '}{notes[quizPly]}</div>}</section>
  </>
}

function Trainer({name,id,fen,moves,notes=[],initialSide='White',back}:{name:string;id:string;fen:string;moves:string[];notes?:string[];initialSide?:'White'|'Black';back:string}){
  const {add,events,entries}=useProgress()
  const navigate=useNavigate()
  const [mode,setMode]=useState<Mode>('Guided')
  const [side,setSide]=useState(initialSide)
  const [started,setStarted]=useState(false)
  const [index,setIndex]=useState(0)
  const [errors,setErrors]=useState(0)
  const [hints,setHints]=useState(0)
  const [hint,setHint]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [flipped,setFlipped]=useState(false)
  const [elapsed,setElapsed]=useState(0)
  const start=useRef(0)
  const timer=useRef<number|undefined>(undefined)
  const [pending,setPending]=useState(false)
  const history=useMemo(()=>line(fen,moves).history,[fen,moves])
  const game=line(fen,moves.slice(0,index)).game
  const target=history[index]
  const done=started&&index>=history.length
  const correct=history.slice(0,index).filter(move=>move.color===side.toLowerCase()[0]).length
  const mastery=events.find(e=>e.key==='opening:'+id)
  const accuracy=Math.round(100*correct/Math.max(1,correct+errors))
  useEffect(()=>()=>clearTimeout(timer.current),[])
  function setup(){
    clearTimeout(timer.current)
    if(mode==='Random variation'){
      const available=entries.filter(e=>e.moves.length>0)
      const next=available[Math.floor(Math.random()*available.length)]
      if(next&&(next.openingPath??next.id)!==id){navigate('/openings/repertoire/'+next.id+'?practice=1');return}
      setMode('Practice')
    }
    setIndex(history[0]?.color===side.toLowerCase()[0]?0:1);setErrors(0);setHints(0);setHint(false);setPending(false);setFeedback('');setElapsed(0);setStarted(true);setFlipped(side==='Black');start.current=Date.now()
  }
  function make(move:InputMove) {
    if(!target||pending||done)return
    if(uci(play(game,move))!==uci(target)){
      setErrors(errors+1);setFeedback('Try the recorded move for this variation.');return
    }
    const after=index+1
    const ply=Math.min(history.length,after+1)
    setIndex(after);setHint(false);setFeedback('Correct.')
    const progress=()=>{
      setIndex(ply);setPending(false)
      if(ply===history.length){
        const secs=Math.round((Date.now()-start.current)/1000)
        const solved=correct+1
        const score=Math.max(0,Math.round(100*(solved-hints*.5)/(solved+errors)))
        setElapsed(secs)
        setFeedback('Variation complete.')
        const previous=mastery?.detail?.split('|').map(Number)
        const attempts=(previous?.[1]??0)+1
        const average=Math.round(((previous?.[0]??0)*(attempts-1)+secs)/attempts)
        add('opening',id,name,score,[average,attempts,solved,errors,hints,side==='White'?0:1].join('|'))
      }
    }
    if(after===ply)progress()
    else{setPending(true);timer.current=window.setTimeout(progress,350)}
  }
  const showing=(mode==='Guided'||hint)&&!pending&&started&&!done
  return <><Heading title="Opening Trainer" description={name} back={{to:back,label:'Back to opening'}}/>
    <div className="studio-grid"><div className="studio-board"><Board fen={game.fen()} flipped={flipped} last={history[index-1]} onMove={started&&!pending&&!done?make:undefined} legal={mode!=='Examination'} arrows={showing&&target?[{from:target.from,to:target.to}]:[]}/>
      <div className="controls"><span className="subtle-label">Practice as {side}</span><span className="controls-spacer"/><button className="icon-button" aria-label="Flip board" onClick={()=>setFlipped(!flipped)}><Repeat2 size={18}/></button></div></div>
      <div className="card studio-panel"><h2>{done?'Variation complete':started?side+' to move':'Set up your session'}</h2>
      <div className="form-grid"><label>Training mode <select disabled={started&&!done} value={mode} onChange={e=>setMode(e.target.value as Mode)}>{practiceModes.map(m=><option key={m} disabled={m==='Random variation'&&!entries.length}>{m}</option>)}</select></label><label>Color <select disabled={started&&!done} value={side} onChange={e=>setSide(e.target.value as typeof side)}>{colorChoices.map(c=><option key={c}>{c}</option>)}</select></label></div>
      {mastery&&<p>Last mastery {mastery.score}% · Average {mastery.detail?.split('|')[0]??'—'} s · Last practiced {new Date(mastery.at).toLocaleDateString()}</p>}
      {started&&<><Meter value={index/history.length*100} label="Opening practice progress"/><p>{correct} correct · {errors} errors · {hints} hints{done?' · '+elapsed+' seconds · '+accuracy+'% accuracy':''}</p></>}
      {showing&&target&&<div className="notice-box"><strong>{target.san}</strong> · {notes[index]??moveNote(target,index)}</div>}
      {feedback&&<p role="status">{feedback}</p>}
      <div className="wrap"><button className="button primary" onClick={setup}>{started?'Restart practice':'Start practice'}</button>{started&&!done&&mode==='Practice'&&<button className="button secondary" disabled={pending||hint} onClick={()=>{setHint(true);setHints(hints+1)}}><Lightbulb size={15}/> Hint</button>}</div>
      {done&&<Link className="text-button" to="/openings/repertoire">Review repertoire <ArrowRight size={15}/></Link>}
    </div></div>
  </>
}

type TreeNode={san:string;children:Map<string,TreeNode>}
function Repertoire({id}:{id?:string}) {
  const {entries,save,remove,events}=useProgress()
  const [params]=useSearchParams()
  const navigate=useNavigate()
  const [color,setColor]=useState<'White'|'Black'>('White')
  const [query,setQuery]=useState('')
  const [name,setName]=useState('')
  const [pgn,setPgn]=useState('')
  const [notice,setNotice]=useState('')
  const entry=entries.find(e=>e.id===id)
  const visible=entries.filter(e=>e.color===color&&e.name.toLowerCase().includes(query.toLowerCase()))
  if(entry&&params.has('practice'))return <Trainer key={entry.id} name={entry.name} id={entry.openingPath??entry.id} fen={entry.fen} moves={entry.moves} initialSide={entry.color} back={'/openings/repertoire/'+entry.id}/>
  const tree=new Map<string,TreeNode>()
  visible.filter(item=>item.fen===initialFen).forEach(item=>{
    let branch=tree
    line(item.fen,item.moves).history.slice(0,10).forEach(move=>{
      if(!branch.has(move.san))branch.set(move.san,{san:move.san,children:new Map()})
      branch=branch.get(move.san)!.children
    })
  })
  function load(){
    try{
      const parsed=parsePgn(pgn.trim())
      if(!parsed.moves.length)throw new Error('Add a PGN with at least one legal move.')
      const title=name.trim()||parsed.headers.Opening||'Imported line'
      save({id:'custom-'+crypto.randomUUID(),name:title,color,notes:'',fen:parsed.fen,moves:parsed.moves});setName('');setPgn('');setNotice('Line added to your '+color.toLowerCase()+' repertoire.')
    }catch(reason){setNotice((reason as Error).message)}
  }
  function exportEntries(items:RepertoireEntry[]){
    downloadFile('academy-repertoire.pgn',items.map(item=>{
      const {game}=line(item.fen,item.moves)
      game.setHeader('Event',item.name.replace(/["\r\n]/g,''))
      if(item.notes)game.setComment(item.notes.replace(/[{}]/g,''))
      return game.pgn()
    }).join('\n\n'))
  }
  if(entry)return <><Heading title={entry.name} description={entry.color+' repertoire'} back={{to:'/openings/repertoire',label:'My repertoire'}}><Link className="button primary" to={'/openings/repertoire/'+entry.id+'?practice=1'}>Practice line <ArrowRight size={15}/></Link></Heading>
    <Replay fen={entry.fen} moves={entry.moves} extra={<><label className="select-label">Personal notes <textarea value={entry.notes} maxLength={4000} onChange={e=>save({...entry,notes:e.target.value})}/></label><div className="wrap"><button className="button secondary" onClick={()=>exportEntries([entry])}><Download size={15}/> PGN</button><button className="button secondary" onClick={()=>{remove(entry.id);navigate('/openings/repertoire')}}>Remove line</button></div></>}/>
  </>
  return <><Heading title="My repertoire" description="Keep opening lines, notes, and practice results in one place." back={{to:'/openings',label:'Chess Openings'}}><button className="button primary" disabled={!visible.length} onClick={()=>exportEntries(visible)}><Download size={16}/> Export {color} PGN</button></Heading>
    <div className="tabs">{colorChoices.map(c=><button key={c} className={'tab '+(color===c?'active':'')} onClick={()=>setColor(c)}>{c} repertoire</button>)}</div>
    <div className="filter-bar"><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search repertoire" placeholder="Search saved lines"/>
    <button className="button secondary" disabled={!visible.length} onClick={()=>navigate('/openings/repertoire/'+visible[Math.floor(Math.random()*visible.length)].id+'?practice=1')}><Shuffle size={16}/> Practice random line</button></div>
    {visible.length?<div className="grid-list">{visible.map(item=><Link className="card list-card" key={item.id} to={'/openings/repertoire/'+item.id}><span className="tag">{item.color} · {item.moves.length} plies</span><h2>{item.name}</h2><p>{events.find(e=>e.key==='opening:'+(item.openingPath??item.id))?.score??0}% mastery</p><span className="text-button">Study line <ChevronRight size={15}/></span></Link>)}</div>:<Empty>No saved {color.toLowerCase()} lines. Save a variation from Chess Openings or import a PGN below.</Empty>}
    <div className="dashboard-grid below"><section className="card panel"><div className="wrap"><GitBranch size={19}/><h2>Opening tree</h2></div>{tree.size?<Branches tree={tree}/>:<p>Save a line from the standard starting position to build your tree.</p>}</section>
      <section className="card panel"><h2>Import a personal line</h2><label className="select-label">Line title <input value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label><label className="select-label">PGN <textarea value={pgn} onChange={e=>setPgn(e.target.value)} maxLength={128000} placeholder="1. e4 e5 2. Nf3 Nc6"/></label><div className="wrap"><label className="button secondary upload"><Upload size={15}/> Load file<input type="file" accept=".pgn,text/plain" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>128000){setNotice('PGN must be smaller than 128 KB.');return}void file.text().then(setPgn)}}/></label><button className="button primary" disabled={!pgn.trim()} onClick={load}>Import PGN</button></div>{notice&&<p role="status">{notice}</p>}</section></div>
  </>
}
function Branches({tree}:{tree:Map<string,TreeNode>}) {
  return <ul className="opening-tree">{[...tree.values()].map(node=><li key={node.san}>{node.children.size?<details open={tree.size===1}><summary>{node.san}</summary><Branches tree={node.children}/></details>:<span>{node.san}</span>}</li>)}</ul>
}
