import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Download, Plus, Shield, Upload, Users } from 'lucide-react'
import Board from '../components/Board'
import Replay from '../components/Replay'
import { downloadFile, Empty, Heading } from '../components/ui'
import { initialFen, line, parsePgn, play, validPosition, type InputMove } from '../chess'
import { lessons, endgames } from '../data/courses'
import { openingFamilies } from '../data/openings'
import { puzzles, primaryTheme, themeName } from '../data/puzzles'
import { useProgress, type Event } from '../progress'
import { client } from '../supabase'

type ClassRecord={id:string;teacher_id:string;name:string;description:string}
type Assignment={id:string;class_id:string;title:string;target:string;instructions:string;due_date:string|null}
type Student={student_id:string;display_name:string;events:Event[]}
type User={user_id:string;display_name:string;role:string}
type Catalog={id:string;title:string;kind:'opening'|'puzzle'|'lesson'|'endgame';fen:string;moves:string[];notes:string[];published:boolean}
const types=['lesson','opening','puzzle','endgame'] as const
const sampleTargets={
  lesson:lessons.map(l=>({label:l.title,path:'/learn/'+l.id})),
  opening:openingFamilies.flatMap(o=>o.variations.map(v=>({label:o.name+' · '+v.name,path:'/openings/'+o.id+'/'+v.id}))),
  puzzle:puzzles.map(p=>({label:themeName(primaryTheme(p))+' · '+p.id,path:'/puzzles/'+p.id})),
  quiz:lessons.map(l=>({label:l.title,path:'/quizzes/'+l.id})),
  endgame:endgames.map(l=>({label:l.title,path:'/endgames/'+l.id}))
}
function assignmentEvent(target:string,events:Event[]){
  const [,section,...ids]=target.split('/')
  const kind=({learn:'lesson',puzzles:'puzzle',openings:'opening',quizzes:'quiz',endgames:'endgame'} as Record<string,string>)[section]
  return events.find(event=>event.key===kind+':'+ids.join('/'))
}
function csv(value:string|number){
  let cell=String(value)
  if(/^[\s]*[=+\-@]/.test(cell))cell="'"+cell
  return '"'+cell.replaceAll('"','""')+'"'
}
function stats(e:Event[]){
  const completed=(kind:string)=>e.filter(item=>item.kind===kind)
  const average=(kind:string)=>{const items=completed(kind);return items.length?Math.round(items.reduce((sum,x)=>sum+x.score,0)/items.length):''}
  const puzzleTime=completed('puzzle').reduce((sum,x)=>sum+(Number(x.detail?.split('|')[1])||0),0)
  const openingTime=completed('opening').reduce((sum,x)=>{const [avg,count]=x.detail?.split('|').map(Number)??[];return sum+((avg??0)*(count??0)||0)},0)
  return {trainingMinutes:Math.round((puzzleTime+openingTime)/60),lessons:completed('lesson').length,quizzes:average('quiz'),puzzles:completed('puzzle').length,practice:average('puzzle'),mastery:average('opening'),endgames:completed('endgame').length}
}
export default function Classroom({admin=false}:{admin?:boolean}){
  const {session,role}=useProgress()
  if(!session||!client)return <><Heading title={admin?'Administration':'Classroom'}/><Empty><Users size={26}/><h2>{client?'Sign in to access classrooms':'Classrooms require an academy connection'}</h2><p>Class invitations, assignments, and progress reports are available when Supabase is configured.</p><Link className="button primary" to="/account">My account</Link></Empty></>
  if(admin)return role==='admin'?<Admin/>:<><Heading title="Administration"/><Empty>Administrator access is required.</Empty></>
  return <Classes id={session.user.id} coach={role==='coach'||role==='admin'}/>
}
function Classes({id,coach}:{id:string;coach:boolean}){
  const {events}=useProgress()
  const [classes,setClasses]=useState<ClassRecord[]>([])
  const [assignments,setAssignments]=useState<Assignment[]>([])
  const [students,setStudents]=useState<Student[]>([])
  const [selected,setSelected]=useState('')
  const [code,setCode]=useState('')
  const [classCode,setClassCode]=useState('')
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [title,setTitle]=useState('')
  const [instructions,setInstructions]=useState('')
  const [deadline,setDeadline]=useState('')
  const [type,setType]=useState<keyof typeof sampleTargets>('lesson')
  const [target,setTarget]=useState('')
  const [status,setStatus]=useState('')
  const [revision,setRevision]=useState(0)
  const selectedClass=classes.find(item=>item.id===selected)
  const owner=selectedClass?.teacher_id===id&&coach
  const refresh=()=>setRevision(r=>r+1)
  useEffect(()=>{
    if(!client)return
    let active=true
    void client.from('academy_classes').select('id,teacher_id,name,description').order('name').then(({data,error})=>{if(!active)return;if(error)setStatus(error.message);else{setClasses(data);setSelected(value=>value||data[0]?.id||'')}})
    return ()=>{active=false}
  },[revision])
  useEffect(()=>{
    if(!client||!selected)return
    let active=true
    const db=client
    setAssignments([]);setStudents([]);setClassCode('')
    void db.from('academy_assignments').select('*').eq('class_id',selected).order('due_date').then(({data,error})=>{if(active){if(error)setStatus(error.message);else setAssignments(data)}})
    if(owner){
      void db.rpc('academy_class_code',{class_key:selected}).then(({data,error})=>{if(active){if(error)setStatus(error.message);else setClassCode(data??'')}})
      void db.rpc('academy_class_report',{class_key:selected}).then(({data,error})=>{if(active){if(error)setStatus(error.message);else setStudents(data??[])}})
    }
    return ()=>{active=false}
  },[selected,owner,revision])
  async function join(e:FormEvent){
    e.preventDefault()
    const {data,error}=await client!.rpc('join_academy_class',{code})
    setStatus(error?error.message:data?'Class joined.':'That invitation code was not found.')
    if(data){setSelected(data);setCode('');refresh()}
  }
  async function create(e:FormEvent){
    e.preventDefault()
    const {data,error}=await client!.from('academy_classes').insert({name:name.trim(),description:description.trim()}).select('id').single()
    setStatus(error?error.message:'Class created.')
    if(data){setSelected(data.id);setName('');setDescription('');refresh()}
  }
  async function assign(e:FormEvent){
    e.preventDefault()
    const {error}=await client!.from('academy_assignments').insert({class_id:selected,title:title.trim(),instructions:instructions.trim(),target,due_date:deadline||null})
    setStatus(error?error.message:'Assignment added.')
    if(!error){setTitle('');setInstructions('');setDeadline('');setTarget('');refresh()}
  }
  function exportReport(){
    const cols=['Student','Lessons completed','Average quiz score','Puzzles solved','Puzzle practice score','Opening mastery','Endgames complete','Recorded puzzle and opening minutes','Assignments complete']
    const records=students.map(student=>{
      const s=stats(student.events)
      return [student.display_name,s.lessons,s.quizzes,s.puzzles,s.practice,s.mastery,s.endgames,s.trainingMinutes,assignments.filter(a=>assignmentEvent(a.target,student.events)).length]
    })
    downloadFile('class-progress.csv',[cols,...records].map(row=>row.map(csv).join(',')).join('\r\n'),'text/csv')
  }
  return <><Heading title="Classroom" description="Join a chess class, review assignments, and see your training progress."/>
    {status&&<div className="notice-box course-banner" role="status">{status}</div>}
    <div className="dashboard-grid"><section className="card panel"><h2>Your classes</h2>{classes.length?<select aria-label="Select a class" value={selected} onChange={e=>setSelected(e.target.value)}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<p>No classes yet.</p>}
      {selectedClass?.description&&<p>{selectedClass.description}</p>}
      {owner&&classCode&&<div className="notice-box">Invitation code <strong>{classCode}</strong></div>}
      {selected&&<div className="form-grid"><h3>Assignments</h3>{assignments.length?assignments.map(a=><div className="card panel" key={a.id}><strong>{a.title}</strong>{a.instructions&&<p>{a.instructions}</p>}<small className="muted">{a.due_date?'Due '+a.due_date:'No deadline'}{!owner&&assignmentEvent(a.target,events)?' · Completed':''}</small><div className="wrap"><Link className="button secondary" to={a.target}>Open assignment <ArrowRight size={15}/></Link>{owner&&<button className="button quiet" onClick={()=>void client!.from('academy_assignments').delete().eq('id',a.id).then(({error})=>{setStatus(error?.message??'Assignment removed.');refresh()})}>Remove</button>}</div></div>):<p>No assignments have been posted.</p>}</div>}
    </section><section className="card panel"><h2>Join a class</h2><form className="form-grid" onSubmit={e=>void join(e)}><label>Invitation code <input value={code} maxLength={12} required onChange={e=>setCode(e.target.value)}/></label><button className="button primary">Join class</button></form>
      {coach&&<><h2>Create a class or group</h2><form className="form-grid" onSubmit={e=>void create(e)}><label>Class name <input value={name} required maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>Description <textarea value={description} maxLength={400} onChange={e=>setDescription(e.target.value)}/></label><button className="button primary"><Plus size={16}/> Create class</button></form></>}
    </section></div>
    {owner&&<div className="dashboard-grid below"><section className="card panel"><h2>Add an assignment</h2><form className="form-grid" onSubmit={e=>void assign(e)}>
      <label>Assignment title <input value={title} required maxLength={100} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Content type <select value={type} onChange={e=>{setType(e.target.value as typeof type);setTarget('')}}>{Object.keys(sampleTargets).map(item=><option key={item}>{item}</option>)}</select></label>
      <label>Activity <select value={target} required onChange={e=>setTarget(e.target.value)}><option value="">Choose an activity</option>{sampleTargets[type].map(item=><option key={item.path} value={item.path}>{item.label}</option>)}</select></label>
      <label>Instructions <textarea value={instructions} maxLength={1000} onChange={e=>setInstructions(e.target.value)}/></label><label>Due date <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><button className="button primary">Assign activity</button>
    </form></section><section className="card panel"><div className="between"><h2>Student progress</h2><button className="button secondary" disabled={!students.length} onClick={exportReport}><Download size={15}/> CSV</button></div>
      {students.length?students.map(s=>{const summary=stats(s.events);const done=assignments.filter(a=>assignmentEvent(a.target,s.events)).length;return <details className="resource" key={s.student_id}><summary>{s.display_name} · {done}/{assignments.length} assignments</summary><p>{summary.lessons} lessons · {summary.puzzles} puzzles · {summary.endgames} endgames · {summary.trainingMinutes} min puzzles and openings</p><p>Quiz average {summary.quizzes||'—'} · Puzzle practice {summary.practice||'—'} · Opening mastery {summary.mastery||'—'}</p>{assignments.some(a=>a.due_date&&a.due_date<new Date().toISOString().slice(0,10)&&!assignmentEvent(a.target,s.events))&&<span className="tag warm">Overdue activity</span>}</details>}):<p>Share the invitation code so students can join.</p>}
    </section></div>}
  </>
}

function Admin(){
  const [tab,setTab]=useState('Content')
  const [catalog,setCatalog]=useState<Catalog[]>([])
  const [users,setUsers]=useState<User[]>([])
  const [status,setStatus]=useState('')
  const [revision,setRevision]=useState(0)
  const [editing,setEditing]=useState<Catalog>()
  const [passing,setPassing]=useState(80)
  useEffect(()=>{
    let active=true
    void client!.from('academy_catalog').select('id,title,kind,fen,moves,notes,published').order('created_at',{ascending:false}).then(({data,error})=>{if(active){if(error)setStatus(error.message);else setCatalog(data)}})
    void client!.from('academy_settings').select('quiz_passing_score').eq('singleton',true).maybeSingle().then(({data})=>{if(active&&data)setPassing(data.quiz_passing_score)})
    void client!.rpc('academy_users').then(({data,error})=>{if(active){if(error)setStatus(error.message);else setUsers(data??[])}})
    return ()=>{active=false}
  },[revision])
  return <><Heading title="Administration" description="Manage account roles and publish validated training demonstrations."/>
    <div className="tabs">{['Content','Users','Overview','Settings'].map(name=><button className={'tab '+(tab===name?'active':'')} key={name} onClick={()=>setTab(name)}>{name}</button>)}</div>
    {status&&<div className="notice-box course-banner" role="status">{status}</div>}
    {tab==='Users'&&<section className="card panel"><h2>Account roles</h2>{users.length?users.map(user=><div className="activity-row" key={user.user_id}><div className="tile-icon green"><Shield size={17}/></div><div><strong>{user.display_name}</strong></div><select aria-label={'Role for '+user.display_name} value={user.role} onChange={e=>void client!.rpc('set_academy_role',{account:user.user_id,new_role:e.target.value}).then(({error})=>{setStatus(error?.message??'Role updated.');setRevision(revision+1)})}>{['student','coach','admin'].map(role=><option key={role}>{role}</option>)}</select></div>):<p>No accounts to display.</p>}</section>}
    {tab==='Settings'&&<section className='card panel account-panel'><h2>Assessment settings</h2><form className='form-grid' onSubmit={e=>{e.preventDefault();void client!.from('academy_settings').update({quiz_passing_score:passing}).eq('singleton',true).then(({error})=>setStatus(error?.message??'Passing score saved.'))}}><label>Quiz passing score (%) <input type='number' min='50' max='100' required value={passing} onChange={e=>setPassing(Number(e.target.value))}/></label><button className='button primary'>Save settings</button></form></section>}
    {tab==='Overview'&&<section className="card panel"><h2>Academy content and access</h2><p>{users.length} accounts · {catalog.filter(item=>item.published).length} published custom activities · {catalog.filter(item=>!item.published).length} drafts</p><p>{lessons.length} core lessons · {puzzles.length} tactical positions · {openingFamilies.length} opening families</p></section>}
    {tab==='Content'&&<><div className="card panel course-banner"><div className="between"><h2>Custom content</h2><button className="button secondary" onClick={()=>setEditing({id:'',title:'',kind:'opening',fen:initialFen,moves:[],notes:[],published:false})}><Plus size={15}/> New demonstration</button></div>
      {catalog.map(item=><button className="button secondary" key={item.id} onClick={()=>setEditing(item)}>{item.title} · {item.published?'Published':'Draft'}</button>)}
      {!catalog.length&&<p>Build a demonstration from a position or import a PGN to get started.</p>}</div>
      {editing&&<Editor key={editing.id+revision} item={editing} onSave={()=>{setEditing(undefined);setRevision(revision+1)}}/>}
    </>}
  </>
}
function Editor({item,onSave}:{item:Catalog;onSave:()=>void}){
  const [state,set]=useState(item)
  const [fenText,setFen]=useState(item.fen)
  const [pgn,setPgn]=useState('')
  const [status,setStatus]=useState('')
  const [preview,setPreview]=useState(false)
  const [busy,setBusy]=useState(false)
  const pos=line(state.fen,state.moves)
  async function submit(published:boolean,action='save'){
    if(busy)return
    setBusy(true)
    const {data,error}=await client!.functions.invoke('publish-content',{body:{...state,id:state.id||undefined,published,action}})
    if(error){
      let message=error.message
      try{message=(await error.context?.json())?.error??message}catch{/* connectivity errors have no body */}
      setStatus(message)
    }else if(data?.error)setStatus(data.error)
    else onSave()
    setBusy(false)
  }
  function load(type:'fen'|'pgn'){
    try{
      if(type==='fen')set({...state,fen:validPosition(fenText.trim()),moves:[],notes:[]})
      else{
        const parsed=parsePgn(pgn.trim())
        validPosition(parsed.fen)
        const history=line(parsed.fen,parsed.moves).history
        set({...state,fen:parsed.fen,moves:parsed.moves,notes:history.map(move=>parsed.comments.find(c=>c.fen===move.after)?.comment??'')});setFen(parsed.fen)
      }
      setStatus('')
    }catch(reason){setStatus((reason as Error).message)}
  }
  function record(input:InputMove){
    const move=play(pos.game,input)
    set({...state,moves:[...state.moves,move.san],notes:[...state.notes,'']})
  }
  return <><div className="studio-grid"><div className="studio-board"><Board fen={pos.game.fen()} onMove={pos.game.isGameOver()?undefined:record} last={pos.history.at(-1)}/><button className="button secondary" disabled={!state.moves.length} onClick={()=>set({...state,moves:state.moves.slice(0,-1),notes:state.notes.slice(0,-1)})}>Undo recorded move</button></div>
    <section className="card panel"><h2>{item.id?'Edit demonstration':'New demonstration'}</h2><div className="form-grid">
      <label>Title <input value={state.title} maxLength={100} onChange={e=>set({...state,title:e.target.value})}/></label>
      <label>Type <select value={state.kind} onChange={e=>set({...state,kind:e.target.value as Catalog['kind']})}>{types.map(kind=><option key={kind}>{kind}</option>)}</select></label>
      <label>Starting FEN <input value={fenText} maxLength={150} onChange={e=>setFen(e.target.value)}/></label><button className="button secondary" onClick={()=>load('fen')}>Set starting position</button>
      <label>PGN <textarea value={pgn} maxLength={128000} onChange={e=>setPgn(e.target.value)}/></label><button className="button secondary" disabled={!pgn.trim()} onClick={()=>load('pgn')}><Upload size={16}/> Import PGN</button>
    </div><h3>Move explanations</h3>{state.moves.map((move,i)=><label key={i} className="select-label">{i+1}. {move}<input value={state.notes[i]} maxLength={700} onChange={e=>set({...state,notes:state.notes.map((note,j)=>i===j?e.target.value:note)})}/></label>)}
    <div className="wrap"><button className="button secondary" onClick={()=>setPreview(!preview)} disabled={!state.moves.length}>{preview?'Hide preview':'Preview'}</button><button className="button secondary" disabled={busy||!state.title.trim()||!state.moves.length} onClick={()=>void submit(false)}>Save draft</button><button className="button primary" disabled={busy||!state.title.trim()||!state.moves.length} onClick={()=>void submit(true)}>Publish</button>{item.id&&<button className="button danger" disabled={busy} onClick={()=>{if(window.confirm('Delete this custom demonstration?'))void submit(false,'delete')}}>Delete</button>}</div>
    {status&&<div className="notice-box error" role="status">{status}</div>}
  </section></div>{preview&&<div className="lesson-summary"><Replay key={state.moves.join(' ')} fen={state.fen} moves={state.moves} notes={state.notes} title={state.title}/></div>}</>
}
export function PublishedContent(){
  const [params]=useSearchParams()
  const [catalog,setCatalog]=useState<Catalog[]>([])
  const [status,setStatus]=useState(client?'Loading custom demonstrations…':'Custom content requires a connected Supabase project.')
  useEffect(()=>{
    if(!client)return
    let active=true
    void client.from('academy_catalog').select('id,title,kind,fen,moves,notes,published').eq('published',true).then(({data,error})=>{if(active){setStatus(error?.message??'No custom demonstrations published yet.');setCatalog(data??[])}})
    return ()=>{active=false}
  },[])
  const chosen=catalog.find(item=>item.id===params.get('id'))
  return <><Heading title={chosen?.title??'Published demonstrations'} back={{to:chosen?'/community':'/resources',label:chosen?'Published demonstrations':'Chess Resources'}}/>
    {chosen?<Replay key={chosen.id} fen={chosen.fen} moves={chosen.moves} notes={chosen.notes}/>:catalog.length?<div className="grid-list">{catalog.map(item=><Link className="card list-card" key={item.id} to={'/community?id='+item.id}><span className="tag">{item.kind}</span><h2>{item.title}</h2><span className="text-button">Open demonstration <ArrowRight size={15}/></span></Link>)}</div>:<Empty>{status}</Empty>}
  </>
}
