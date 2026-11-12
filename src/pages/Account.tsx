import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, ChevronRight, Flame, GraduationCap, Medal, ShieldCheck, Target, Trophy, User, Zap } from 'lucide-react'
import { Empty, Heading, Meter } from '../components/ui'
import { client } from '../supabase'
import { day, levels, offsetDay, rank, streak, useProgress } from '../progress'
import { glossary, resources } from '../data/resources'
import { achievements } from '../data/achievements'

export default function Account({page}:{page:string}){
  if(page==='account')return <Authentication/>
  if(page==='settings')return <Settings/>
  if(page==='resources')return <Resources/>
  if(page==='leaderboard')return <Leaderboard/>
  return <Progress/>
}
function Authentication(){
  const {session,profile,update,sync}=useProgress()
  const [params,setParams]=useSearchParams()
  const mode=params.get('mode')??'login'
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [name,setName]=useState('')
  const [skill,setSkill]=useState(profile.level)
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    if(!client)return
    const {data:{subscription}}=client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setParams({mode:'reset'})})
    return ()=>subscription.unsubscribe()
  },[setParams])
  function switchMode(next:string){setNotice('');setParams({mode:next})}
  async function submit(e:FormEvent){
    e.preventDefault()
    if(!client)return
    setBusy(true);setNotice('')
    try{
      if(mode==='register'){
        const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:name,level:skill},emailRedirectTo:window.location.origin+'/account'}})
        if(error)throw error
        update({name,level:skill})
        setNotice(data.session?'Account created.':'Check your email to verify your account.')
      }else if(mode==='forgot'){
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/account?mode=reset'})
        if(error)throw error
        setNotice('If an account matches that address, a password reset link will arrive by email.')
      }else if(mode==='reset'){
        const {error}=await client.auth.updateUser({password})
        if(error)throw error
        switchMode('login');setNotice('Password updated.')
      }else{
        const {error}=await client.auth.signInWithPassword({email,password})
        if(error)throw error
        setNotice('Signed in.')
      }
    }catch(reason){setNotice((reason as Error).message)}
    finally{setBusy(false)}
  }
  if(session&&mode!=='reset')return <><Heading title="My account" description={sync}/><div className="card panel account-panel"><div className="section-title"><div className="tile-icon green"><User size={20}/></div><div><h2>{profile.name||'Learner'}</h2><p>{session.user.email}</p></div></div><Link className="button secondary" to="/settings">Edit profile</Link><button className="button primary" onClick={()=>void client?.auth.signOut().then(({error})=>{if(error)setNotice(error.message);else setNotice('Signed out.')})}>Sign out</button>{notice&&<p role="status">{notice}</p>}</div></>
  const label=mode==='register'?'Create an account':mode==='forgot'?'Reset your password':mode==='reset'?'Choose a new password':'Sign in'
  return <><Heading title={label} description="Keep your training progress in sync across devices."/>
    {client?<div className="card panel account-panel"><form className="form-grid" onSubmit={e=>void submit(e)}>
      {mode==='register'&&<><label>Display name <input value={name} required maxLength={60} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label><label>Starting level <select value={skill} onChange={e=>setSkill(e.target.value as typeof skill)}>{levels.map(level=><option key={level}>{level}</option>)}</select></label></>}
      {mode!=='reset'&&<label>Email <input type="email" value={email} required autoComplete="email" maxLength={254} onChange={e=>setEmail(e.target.value)}/></label>}
      {mode!=='forgot'&&<label>Password <input type="password" value={password} required minLength={mode==='login'?1:8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} onChange={e=>setPassword(e.target.value)}/></label>}
      <button className="button primary" disabled={busy}>{busy?'Working…':mode==='forgot'?'Send reset link':label}</button></form>
      {notice&&<div className="notice-box" role="status">{notice}</div>}
      <div className="wrap">{mode!=='login'?<button className="text-button" onClick={()=>switchMode('login')}>Back to sign in</button>:<><button className="text-button" onClick={()=>switchMode('register')}>Create account</button><button className="text-button" onClick={()=>switchMode('forgot')}>Forgot password?</button></>}</div><Link className="button secondary" to="/">Continue as guest</Link>
    </div>:<div className="card panel account-panel"><div className="tile-icon green"><ShieldCheck size={20}/></div><h2>Guest mode</h2><p>Academy progress is saved on this device. Account registration and device synchronization require a configured Supabase project.</p><div className="wrap"><Link className="button primary" to="/">Continue as guest</Link><Link className="button secondary" to="/settings">Set up my profile</Link></div></div>}
  </>
}
function Settings(){
  const {profile,update,sync}=useProgress()
  const [avatarStatus,setAvatarStatus]=useState('')
  return <><Heading title="Settings" description="Customize your profile, board, and training goals."/>
    <div className="dashboard-grid"><section className="card panel"><h2>Learning profile</h2><div className="form-grid">
      <label>Display name <input value={profile.name} onChange={e=>update({name:e.target.value})} maxLength={60} placeholder="Guest learner"/></label>
      <label>Profile photo <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
        const file=e.target.files?.[0];if(!file)return
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>75000){setAvatarStatus('Choose a PNG, JPEG, or WebP image below 75 KB.');return}
        const reader=new FileReader();reader.onload=()=>{update({avatar:String(reader.result)});setAvatarStatus('Profile photo saved.')};reader.readAsDataURL(file)
      }}/></label>
      {profile.avatar&&<button className="button secondary" onClick={()=>update({avatar:''})}>Remove profile photo</button>}
      {avatarStatus&&<p role="status">{avatarStatus}</p>}
      <label>Learning level <select value={profile.level} onChange={e=>update({level:e.target.value as typeof profile.level})}>{levels.map(level=><option key={level}>{level}</option>)}</select></label>
      <label>Weekly training days <select value={profile.goal} onChange={e=>update({goal:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(goal=><option key={goal}>{goal}</option>)}</select></label>
      <label>Daily training goal <select value={profile.dailyMinutes} onChange={e=>update({dailyMinutes:Number(e.target.value)})}><option value={0}>Recommended for my level</option>{[15,20,25,30,45,60,75,90].map(minutes=><option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
      <label><input type="checkbox" checked={profile.public} onChange={e=>update({public:e.target.checked})}/> Include my display name in the leaderboard</label>
    </div><Link className="text-button" to="/quizzes/assessment">Take placement assessment <ChevronRight size={15}/></Link><p>{sync}</p></section>
    <section className="card panel"><h2>Appearance and accessibility</h2><div className="form-grid">
      <label>Theme <select value={profile.theme} onChange={e=>update({theme:e.target.value as typeof profile.theme})}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>
      <label>Board colors <select value={profile.board} onChange={e=>update({board:e.target.value as typeof profile.board})}><option value="green">Forest green</option><option value="walnut">Walnut</option><option value="blue">Slate blue</option></select></label>
      <label><input type="checkbox" checked={profile.contrast} onChange={e=>update({contrast:e.target.checked})}/> High contrast</label>
      <label><input type="checkbox" checked={!profile.motion} onChange={e=>update({motion:!e.target.checked})}/> Reduce motion</label>
      <label><input type="checkbox" checked={profile.sound} onChange={e=>update({sound:e.target.checked})}/> Play sounds in computer games</label>
    </div></section></div>
  </>
}
function Progress(){
  const {profile,xp,events}=useProgress()
  const activity=events.filter(e=>e.kind!=='record')
  const badges=achievements.filter(a=>a.test(events))
  const completed=events.filter(e=>e.kind==='lesson').length
  const solved=events.filter(e=>e.kind==='puzzle')
  const accuracy=solved.length?Math.round(solved.reduce((sum,e)=>sum+e.score,0)/solved.length):null
  const counts=Array.from({length:14},(_,i)=>activity.filter(e=>day(new Date(e.at))===offsetDay(i-13)).length)
  const high=Math.max(...counts,1)
  return <><Heading title="My Progress" description="Review your course completion, tactical practice, and recent activity."/>
    <div className="stats-grid">{[[GraduationCap,'Lessons',completed+'/75'],[Target,'Puzzles',solved.length],[Flame,'Streak',streak(events)+' days'],[Zap,'Experience',xp+' XP']].map(([Icon,label,value])=>{const Item=Icon as typeof Zap;return <div className="card stat" key={String(label)}><div className="tile-icon green"><Item size={20}/></div><div className="stat-copy"><span>{String(label)}</span><strong>{String(value)}</strong></div></div>})}</div>
    <div className="dashboard-grid"><section className="card panel"><h2>Training activity</h2><p>Completed activities per day over the last two weeks.</p><div className="training-chart" role="img" aria-label={'Training activity for the last 14 days: '+counts.join(', ')}>{counts.map((count,i)=><div key={i} title={offsetDay(i-13)+': '+count}><i style={{height:Math.max(3,count/high*100)+'%'}}/></div>)}</div><div className="between small muted"><span>{offsetDay(-13)}</span><span>Today</span></div></section>
      <section className="card panel"><h2>{rank(xp)} rank</h2><p>{profile.level} course · {accuracy===null?'Solve a puzzle to see your practice score.':'Average puzzle practice score '+accuracy+'%'}</p><Meter value={completed/75*100} label="Overall course completion"/><p>{Math.round(completed/75*100)}% of all lessons completed</p></section></div>
    <h2 className="block-title">Achievements · {badges.length}/{achievements.length}</h2>
    <div className="grid-list">{achievements.map(a=>{const earned=a.test(events);return <article key={a.name} className={'card list-card badge-card '+(earned?'earned':'')}><div className={'tile-icon '+(earned?'gold':'green')}>{earned?<Trophy size={20}/>:<Medal size={20}/>}</div><h2>{a.name}</h2><p>{a.description}</p><span className="tag">{earned?'Earned':'In progress'}</span></article>})}</div>
    <section className="card panel lesson-summary"><h2>Activity history</h2>{activity.length?[...activity].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30).map(e=><div key={e.key} className="activity-row"><div className="tile-icon green"><Award size={17}/></div><div><strong>{e.title}</strong><small>{new Date(e.at).toLocaleDateString()} · {e.score}%</small></div><b>+{e.xp} XP</b></div>):<p>Start a lesson or puzzle to record your first activity.</p>}</section>
  </>
}
function Leaderboard(){
  const {session,profile}=useProgress()
  const [rows,setRows]=useState<{display_name:string;solved:number}[]>([])
  const [status,setStatus]=useState(client?'Loading standings…':'The shared leaderboard requires a connected Supabase project.')
  useEffect(()=>{
    if(!client)return
    let active=true
    void client.rpc('academy_leaderboard').then(({data,error})=>{if(!active)return;setRows(data??[]);setStatus(error?error.message:'No learners have opted in and recorded a verified puzzle yet.')})
    return ()=>{active=false}
  },[])
  return <><Heading title="Leaderboard" description="Standings are based on distinct verified puzzle solutions from learners who opt in."/><section className="card panel"><h2>Academy puzzle standings</h2>{rows.length?rows.map((row,i)=><div key={i} className="activity-row"><div className="tile-icon gold">{i+1}</div><div><strong>{row.display_name}</strong></div><b>{row.solved} puzzles</b></div>):<p role="status">{status}</p>}{session&&!profile.public&&<Link className="button secondary" to="/settings">Manage participation</Link>}{!session&&client&&<Link className="button secondary" to="/account">Sign in to participate</Link>}</section></>
}
function Resources(){
  return <><Heading title="Chess Resources" description="Review rules, read standard notation, and prepare for tournament play."/>
    <div className="dashboard-grid"><section className="card panel"><h2>Rules and tournament practice</h2>{resources.map(item=><details className="resource" key={item.title}><summary>{item.title}</summary><p>{item.body}</p><details><summary>{item.question}</summary><p>{item.answer}</p></details></details>)}
    <a className="text-button" href="https://handbook.fide.com/chapter/e012023" target="_blank" rel="noreferrer">FIDE Laws of Chess · effective 1 January 2023 <ChevronRight size={15}/></a></section>
    <section className="card panel"><h2>Filipino chess glossary</h2><p>Standard algebraic notation stays the same in every language.</p>{glossary.map(([en,fil])=><div className="between resource" key={en}><strong>{en}</strong><span>{fil}</span></div>)}<Link className="button secondary" to="/community">Published demonstrations <ChevronRight size={15}/></Link><h2>Data sources</h2><a className="text-button" href="https://database.lichess.org/" target="_blank" rel="noreferrer">Lichess Open Database · CC0</a><a className="text-button" href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noreferrer">Lichess chess-openings · CC0</a><a className="text-button" href="https://github.com/nmrugg/stockfish.js/tree/v17.1" target="_blank" rel="noreferrer">Stockfish.js · GPL</a></section></div>
  </>
}
