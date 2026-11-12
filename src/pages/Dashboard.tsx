import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, ChevronRight, CircleCheck, Flame, GraduationCap, Play, Sparkles, Target, Trophy, Zap } from 'lucide-react'
import { Chess } from 'chess.js'
import Board from '../components/Board'
import { Meter } from '../components/ui'
import { lessons } from '../data/courses'
import { dailyPuzzle } from '../data/puzzles'
import { colorName, initialFen, line } from '../chess'
import { day, offsetDay, puzzleRating, streak, useProgress } from '../progress'

const featureMoves='e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7'.split(' ')
export default function Dashboard() {
  const {profile,events,xp}=useProgress()
  const solved=events.filter(e=>e.kind==='puzzle')
  const completed=events.filter(e=>e.kind==='lesson')
  const curriculum=lessons.filter(l=>l.level===profile.level)
  const next=curriculum.find(l=>!completed.some(e=>e.key==='lesson:'+l.id))??lessons.find(l=>!completed.some(e=>e.key==='lesson:'+l.id))
  const courseDone=curriculum.filter(l=>completed.some(e=>e.key==='lesson:'+l.id)).length
  const puzzle=dailyPuzzle()
  const puzzleSide=new Chess(puzzle.fen).turn()
  const today=day()
  const weekday=(new Date().getDay()+6)%7
  const activity=events.filter(e=>e.kind!=='record').sort((a,b)=>b.at.localeCompare(a.at))
  const dateLabel=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date())
  const dailyDone=events.some(e=>e.key==='daily:'+today)
  const week=Array.from({length:7},(_,i)=>({label:'MTWTFSS'[i],date:offsetDay(i-weekday),active:i===weekday}))
  const weekly=week.filter(d=>activity.some(e=>day(new Date(e.at))===d.date)).length
  const rating=puzzleRating(events)
  const stats=[
    {label:'Lessons completed',value:completed.length,note:'of '+lessons.length+' lessons',icon:BookOpen,tone:'green',to:'/learn'},
    {label:'Puzzles solved',value:solved.length,note:rating?'Rating '+rating:'Build your tactics',icon:Target,tone:'purple',to:'/puzzles'},
    {label:'Training streak',value:streak(events),note:streak(events)===1?'day in a row':'days in a row',icon:Flame,tone:'orange',to:'/progress'},
    {label:'Experience points',value:xp.toLocaleString(),note:'Total XP earned',icon:Zap,tone:'gold',to:'/progress'}
  ]
  return <div className="dashboard">
    <div className="dash-welcome"><div><h1>{profile.name?'Welcome back, '+profile.name.split(' ')[0]+'!':'Welcome to the Academy'}</h1><p>Your place to learn, practice, and play better chess.</p></div><div className="date-label"><CalendarDays size={16}/>{dateLabel}</div></div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <div className="hero-level"><GraduationCap size={15}/>{profile.level} path</div>
        <h2 id="hero-title">Think ahead.<br/><em>Play better.</em></h2>
        <p>{next?'Build your skills one move at a time. Your next lesson is ready when you are.':'Keep your skills sharp with a new tactical position.'}</p>
        <Link className="button hero-button" to={next?'/learn/'+next.id:'/puzzles'}><Play size={16} fill="currentColor"/>{next?'Continue Learning':'Practice tactics'}<ArrowRight size={17}/></Link>
      </div>
      <div className="hero-progress"><div className="between"><span>{profile.level} course</span><strong>{Math.round(courseDone/25*100)}%</strong></div><Meter label="Current course completion" value={courseDone/25*100}/></div>
    </section>
    <section className="stats-grid" aria-label="Training overview">
      {stats.map(({label,value,note,icon:Icon,tone,to})=><Link className="card stat" to={to} key={label}><div className={'tile-icon '+tone}><Icon size={20} strokeWidth={1.85}/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></Link>)}
    </section>
    <div className="dashboard-grid">
      <section className="card daily-card">
        <div className="section-heading"><div className="section-title"><div className="tile-icon green"><Target size={20}/></div><div><h2>Daily Puzzle</h2><p>A fresh tactical position every day</p></div></div><span className="tag warm"><Sparkles size={12}/> Daily challenge</span></div>
        <div className="daily-layout">
          <Link className="daily-board" to="/daily" aria-label="Open daily puzzle"><Board fen={puzzle.fen} flipped={puzzleSide==='b'} compact/></Link>
          <div className="daily-copy"><div className="eyebrow"><span className="side-dot" data-color={puzzleSide}/>{colorName(puzzleSide)} to move</div><h3>Find the winning move.</h3><p>Study the position and look for a forcing continuation.</p><Link className="button primary" to="/daily">{dailyDone?'Review Puzzle':'Solve Puzzle'} <ArrowRight size={16}/></Link><small><Zap size={14}/> +25 XP daily bonus</small></div>
        </div>
      </section>
      <div className="dashboard-stack">
        <section className="card feature-card">
          <div className="section-heading"><div className="section-title"><div className="tile-icon gold"><BookOpen size={19}/></div><div><h2>Featured Opening</h2><p>Explore a classic line</p></div></div></div>
          <Link className="feature-link" to="/openings/ruy-lopez/closed-variation"><div className="feature-board" aria-hidden><Board fen={line(initialFen,featureMoves.slice(0,6)).game.fen()} compact coordinates={false}/></div><div><strong>Ruy Lopez</strong><small>Closed Variation · C92</small><span>Explore opening <ArrowRight size={14}/></span></div><ChevronRight className="feature-chevron" size={17}/></Link>
        </section>
        <section className="card weekly-card">
          <div className="section-heading"><div className="section-title"><div className="tile-icon green"><Trophy size={19}/></div><div><h2>Weekly Goal</h2><p>Train on {profile.goal} days this week</p></div></div><strong className="weekly-count">{weekly}/{profile.goal}</strong></div>
          <Meter value={weekly/profile.goal*100} label="Weekly training goal"/>
          <div className="week-days">{week.map(d=>{const done=activity.some(e=>day(new Date(e.at))===d.date);return <div key={d.date} className={(d.active?'today ':'')+(done?'done':'')} aria-label={d.date+(done?' completed':'')}><span>{d.label}</span><i>{done?<CircleCheck size={16}/>:d.active?<span/>:null}</i></div>})}</div>
        </section>
      </div>
    </div>
    <div className="dashboard-grid below">
      <section className="card lower-card"><div className="section-heading"><h2>Recommended next</h2><Link className="text-button" to="/learn">All lessons <ArrowRight size={15}/></Link></div>{next?<Link className="activity-row" to={'/learn/'+next.id}><div className="tile-icon green"><GraduationCap size={18}/></div><div><strong>{next.title}</strong><small>{next.level} · {next.minutes} min</small></div><ChevronRight size={18}/></Link>:<p>All courses completed.</p>}</section>
      <section className="card lower-card"><div className="section-heading"><h2>Recent activity</h2><Link className="text-button" to="/progress"><ArrowDown size={16}/> History</Link></div>{activity.length?activity.slice(0,3).map(e=><div className="activity-row" key={e.key}><div className="tile-icon gold"><CircleCheck size={18}/></div><div><strong>{e.title}</strong><small>{new Date(e.at).toLocaleDateString()}</small></div><b>+{e.xp} XP</b></div>):<p className="muted">Complete a lesson or solve a puzzle to start your training history.</p>}</section>
    </div>
  </div>
}
