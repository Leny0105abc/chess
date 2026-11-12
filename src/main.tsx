import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Flame, Menu, Moon, Search, Sun, X, Zap } from 'lucide-react'
import { ProgressProvider, rank, streak, useProgress } from './progress'
import { sections, settings, classroom, admin } from './navigation'
import Dashboard from './pages/Dashboard'
import { lessons } from './data/courses'
import './style.css'

const Learn=lazy(()=>import('./pages/Learn'))
const Openings=lazy(()=>import('./pages/Openings'))
const Puzzles=lazy(()=>import('./pages/Puzzles'))
const Studio=lazy(()=>import('./pages/Studio'))
const Account=lazy(()=>import('./pages/Account'))
const Classroom=lazy(()=>import('./pages/Classroom'))
const Published=lazy(()=>import('./pages/Classroom').then(module=>({default:module.PublishedContent})))

function Logo(){return <div className="brand-mark" aria-hidden>♞</div>}
function Shell() {
  const [collapsed,setCollapsed]=useState(false)
  const [drawer,setDrawer]=useState(false)
  const [overlay,setOverlay]=useState<'search'|'alerts'|'account'>()
  const [search,setSearch]=useState('')
  const [matches,setMatches]=useState<{name:string;path:string}[]>([])
  const {profile,events,xp,update,session,role}=useProgress()
  const location=useLocation()
  const navigate=useNavigate()
  const all=[...sections.flatMap(group=>group.links),settings,classroom,...(role==='admin'?[admin]:[])]
  const active=all.find(link=>link.path==='/'?location.pathname==='/':location.pathname.startsWith(link.path))?.name??'Account'
  const alerts=events.filter(event=>event.kind!=='record').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5)
  useEffect(()=>{setDrawer(false);setOverlay(undefined);window.scrollTo(0,0)},[location.pathname])
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOverlay('search')}
      if(e.key==='Escape'){setOverlay(undefined);setDrawer(false)}
    }
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)
  },[])
  useEffect(()=>{
    const q=search.trim().toLowerCase()
    if(!q){setMatches([]);return}
    let current=true
    const basic=[...sections.flatMap(group=>group.links),settings,classroom].filter(item=>item.name.toLowerCase().includes(q))
    setMatches(basic)
    void import('./data/openings').then(openings=>{
      if(current)setMatches([...basic,...lessons.filter(l=>l.title.toLowerCase().includes(q)).map(l=>({name:l.title,path:'/learn/'+l.id})),...openings.openingFamilies.filter(f=>f.name.toLowerCase().includes(q)).map(f=>({name:f.name,path:'/openings/'+f.id}))].slice(0,12))
    })
    return ()=>{current=false}
  },[search])
  const nav=(link:typeof settings)=> <NavLink key={link.path} end={link.path==='/'} to={link.path} className="nav-link" title={collapsed?link.name:undefined}><link.icon size={18} strokeWidth={1.75}/><span>{link.name}</span></NavLink>
  return <div className={'shell'+(collapsed?' collapsed':'')+(drawer?' drawer-open':'')}>
    <a href="#main" className="skip">Skip to content</a>
    {drawer&&<button className="drawer-backdrop" aria-label="Close navigation" onClick={()=>setDrawer(false)}/>}
    <aside className="sidebar" aria-label="Primary navigation">
      <Link to="/" className="brand"><Logo/><span>ChessMaster<small>ACADEMY</small></span></Link>
      <nav>{sections.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.links.map(nav)}</div>)}
        <div className="nav-group nav-settings">{session&&nav(classroom)}{role==='admin'&&nav(admin)}{nav(settings)}</div>
      </nav>
      <Link to="/account" className="side-profile"><span className="avatar">{profile.avatar?<img src={profile.avatar} alt=""/>:profile.name.slice(0,1).toUpperCase()||'♟'}</span><span><strong>{profile.name||'Guest learner'}</strong><small>{profile.level} · {rank(xp)}</small></span><ChevronRight size={15}/></Link>
      <button className="collapse-toggle icon-button" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<ChevronRight size={14}/>:<ChevronLeft size={14}/>}</button>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setDrawer(!drawer)}><Menu size={22}/></button>
        <div className="breadcrumb">{active}</div>
        <button className="top-search" onClick={()=>{setSearch('');setOverlay('search')}}><Search size={17}/><span>Search lessons, openings...</span><kbd>{/Mac|iPhone|iPad/.test(navigator.platform)?'⌘ K':'Ctrl K'}</kbd></button>
        <div className="top-actions">
          <Link className="top-stat top-streak" to="/progress" title="Training streak"><Flame size={18}/><span>{streak(events)}</span></Link>
          <Link className="top-stat top-xp" to="/progress" title="Experience points"><Zap size={17}/><span>{xp} XP</span></Link>
          <span className="top-divider"/>
          <button className="icon-button theme-button" aria-label="Toggle theme" onClick={()=>update({theme:document.documentElement.dataset.theme==='dark'?'light':'dark'})}>{profile.theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
          <button className="icon-button notice" aria-label="Notifications" onClick={()=>setOverlay(overlay==='alerts'?undefined:'alerts')}><Bell size={19}/>{alerts.length>0&&<i/>}</button>
          <button className="top-profile" aria-label="Account menu" onClick={()=>setOverlay(overlay==='account'?undefined:'account')}><span className="avatar">{profile.avatar?<img src={profile.avatar} alt=""/>:profile.name[0]?.toUpperCase()||'♟'}</span><ChevronDown size={13}/></button>
        </div>
        {overlay==='alerts'&&<div className="popover card"><h3>Notifications</h3>{alerts.length?alerts.map(event=><p key={event.key}>{event.title} <small>+{event.xp} XP</small></p>):<p className="muted">Your training milestones will appear here.</p>}<Link to="/progress">View progress</Link></div>}
        {overlay==='account'&&<div className="popover card"><h3>{profile.name||'Guest learner'}</h3><Link to="/account">{session?'Manage account':'Sign in or create account'}</Link><Link to="/classroom">Classroom</Link><Link to="/settings">Settings</Link></div>}
      </header>
      <main id="main" className="main-content">
        <Suspense fallback={<div className="card empty" role="status">Loading training area…</div>}><Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/learn/*" element={<Learn section="learn"/>}/><Route path="/endgames/*" element={<Learn section="endgames"/>}/><Route path="/quizzes/*" element={<Learn section="quizzes"/>}/>
          <Route path="/openings/*" element={<Openings/>}/>
          <Route path="/puzzles/*" element={<Puzzles/>}/><Route path="/daily" element={<Puzzles daily/>}/>
          <Route path="/play" element={<Studio mode="play"/>}/><Route path="/analysis" element={<Studio mode="analysis"/>}/>
          {['account','leaderboard','progress','settings','resources'].map(route=><Route key={route} path={'/'+route} element={<Account page={route}/>}/>)}
          <Route path="/community" element={<Published/>}/><Route path="/classroom" element={<Classroom/>}/><Route path="/admin" element={<Classroom admin/>}/>
          <Route path="*" element={<div className="card empty"><h1>Page not found</h1><Link className="button primary" to="/">Return to Dashboard</Link></div>}/>
        </Routes></Suspense>
        <footer className="footer"><span>ChessMaster Academy</span><Link to="/resources">Chess resources</Link></footer>
      </main>
    </div>
    {overlay==='search'&&<div className="modal-backdrop" onClick={()=>setOverlay(undefined)}><section className="search-modal card" role="dialog" aria-modal="true" aria-label="Search academy" onClick={e=>e.stopPropagation()}>
      <div className="search-input"><Search size={20}/><input autoFocus placeholder="Search lessons, openings, or tools" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&matches[0]){navigate(matches[0].path);setOverlay(undefined)}}}/><button className="icon-button" onClick={()=>setOverlay(undefined)} aria-label="Close search"><X size={20}/></button></div>
      <div className="search-results">{(search?matches:all.slice(0,8)).map(item=><Link key={item.path} to={item.path} onClick={()=>setOverlay(undefined)}>{item.name}<ChevronRight size={16}/></Link>)}{search&&!matches.length&&<p className="muted">No results for “{search}”.</p>}</div>
    </section></div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><ProgressProvider><Shell/></ProgressProvider></BrowserRouter></StrictMode>)
if(import.meta.env.PROD&&'serviceWorker' in navigator) window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{})})
