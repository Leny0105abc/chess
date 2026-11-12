import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { client } from './supabase'
import type { Session } from '@supabase/supabase-js'

export const levels=['Beginner','Intermediate','Advanced'] as const
export type Level=typeof levels[number]
export type EventKind='lesson'|'puzzle'|'daily'|'opening'|'quiz'|'endgame'|'game'|'record'
export type Event={key:string;kind:EventKind;title:string;at:string;score:number;xp:number;detail?:string}
export type Profile={name:string;level:Level;goal:number;dailyMinutes:number;theme:'light'|'dark'|'system';contrast:boolean;motion:boolean;sound:boolean;board:'green'|'walnut'|'blue';avatar:string;public:boolean}
export type RepertoireEntry={id:string;name:string;color:'White'|'Black';notes:string;fen:string;moves:string[];openingPath?:string;updatedAt?:string;removed?:boolean}
const defaults:Profile={name:'',level:'Beginner',goal:5,dailyMinutes:0,theme:'light',contrast:false,motion:true,sound:false,board:'green',avatar:'',public:false}
const awards:Record<EventKind,number>={lesson:40,puzzle:15,daily:25,opening:30,quiz:25,endgame:35,game:35,record:0}
function read<T>(key:string,fallback:T):T {
  try {return JSON.parse(localStorage.getItem(key)??'null')??fallback} catch {return fallback}
}
function persist(key:string,value:unknown) {try {localStorage.setItem(key,JSON.stringify(value))}catch{/* guest storage may be disabled */}}
export function day(date=new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
}
export function offsetDay(delta:number) {const d=new Date();d.setDate(d.getDate()+delta);return day(d)}
export function streak(events:Event[]) {
  const dates=new Set(events.filter(e=>e.kind!=='record').map(e=>day(new Date(e.at))))
  let n=0
  const start=dates.has(day())?0:1
  while(dates.has(offsetDay(-n-start)))n++
  return n
}
export function puzzleRating(events:Event[]) {
  const attempts=events.filter(e=>e.key.startsWith('record:puzzle-rating:')).sort((a,b)=>a.at.localeCompare(b.at))
  if(!attempts.length)return null
  const estimate=attempts.reduce((rating,attempt)=>{
    const difficulty=Number(attempt.detail)||1200
    const expected=1/(1+10**((difficulty-rating)/400))
    return Math.max(100,rating+28*(attempt.score/100-expected))
  },1200)
  return Math.round(estimate)
}
export function rank(xp:number) {return ['Pawn','Knight','Bishop','Rook','Queen','King','Chess Master','Grandmaster Scholar'][[100,250,500,850,1400,2500,4500].filter(t=>xp>=t).length]}
function merge<T>(first:T[],second:T[],key:(value:T)=>string,updated:(value:T)=>string) {
  const byKey=new Map(first.map(e=>[key(e),e]))
  for(const item of second){
    const id=key(item)
    const current=byKey.get(id)
    if(!current||updated(item)>updated(current))byKey.set(id,item)
  }
  return [...byKey.values()]
}
type State={
 profile:Profile;update:(patch:Partial<Profile>)=>void;events:Event[];add:(kind:EventKind,id:string,title:string,score?:number,detail?:string)=>void;
 xp:number;session:Session|null;role:string;sync:string;entries:RepertoireEntry[];save:(entry:RepertoireEntry)=>void;remove:(id:string)=>void;
 verifyPuzzle:(id:string,moves:string[])=>void
}
type Workspace={profile:Profile;events:Event[];entries:RepertoireEntry[];profileAt:string}
const Context=createContext<State|null>(null)
function guest():Workspace{
  const saved=read('cma-guest',{profile:{...defaults,...read('cma-profile',{})},events:read('cma-events',[]),entries:read('cma-repertoire',[]),profileAt:''})
  return {...saved,profile:{...defaults,...saved.profile}}
}
function account(id:string):Workspace{
  const saved=read<Workspace>('cma-account:'+id,{profile:defaults,events:[],entries:[],profileAt:''})
  return {...saved,profile:{...defaults,...saved.profile}}
}
function accountProfile(profile:unknown):Partial<Profile> {
  if(!profile||typeof profile!=='object')return {}
  const input=profile as Partial<Profile>
  const {name,avatar,goal,dailyMinutes,level,theme,board,contrast,motion,sound}=input
  return {
    ...(typeof name==='string'?{name:name.slice(0,60)}:{}),
    ...(typeof avatar==='string'&&(!avatar||/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar))?{avatar}:{}),
    ...(typeof goal==='number'&&goal>=1&&goal<=7?{goal}:{}),
    ...(typeof dailyMinutes==='number'&&(dailyMinutes===0||dailyMinutes>=10&&dailyMinutes<=120)?{dailyMinutes}:{}),
    ...(level&&levels.includes(level)?{level}:{}),
    ...(theme&&['light','dark','system'].includes(theme)?{theme}:{}),
    ...(board&&['green','walnut','blue'].includes(board)?{board}:{}),
    ...(typeof contrast==='boolean'?{contrast}:{}),
    ...(typeof motion==='boolean'?{motion}:{}),
    ...(typeof sound==='boolean'?{sound}:{}),
    public:input.public===true,
  }
}
export function ProgressProvider({children}:{children:ReactNode}) {
  const [workspace,setWorkspace]=useState(guest)
  const [session,setSession]=useState<Session|null>(null)
  const [role,setRole]=useState('student')
  const [sync,setSync]=useState('Guest progress saved on this device')
  const [scope,setScope]=useState('')
  const [loaded,setLoaded]=useState('')
  const {profile,events,entries,profileAt}=workspace
  useEffect(()=>{
    if(!client)return
    let mounted=true
    void client.auth.getSession().then(({data})=>{if(mounted)setSession(data.session)})
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,active)=>setSession(active))
    return ()=>{mounted=false;subscription.unsubscribe()}
  },[])
  const userId=session?.user.id??''
  useEffect(()=>{
    setScope(userId)
    setRole('student')
    setLoaded('')
    if(!userId||!client){setWorkspace(guest());setSync('Guest progress saved on this device');return}
    const db=client
    let active=true
    const key='cma-account:'+userId
    setWorkspace(account(userId))
    setSync('Connecting to Supabase…')
    const pull=()=>{void db.from('academy_state').select('profile,events,repertoire,role').eq('user_id',userId).maybeSingle().then(({data,error})=>{
      if(!active)return
      if(data){
        const stamp=typeof data.profile?.updatedAt==='string'?data.profile.updatedAt:''
        setWorkspace(w=>({
          profile:stamp>=w.profileAt?{...w.profile,...accountProfile(data.profile)}:w.profile,
          profileAt:stamp>=w.profileAt?stamp:w.profileAt,
          events:merge(w.events,data.events??[],e=>e.key,e=>e.at),
          entries:merge(w.entries,data.repertoire??[],e=>e.id,e=>e.updatedAt??'')
        }))
        setRole(data.role)
      }
      if(error)setSync('Cloud unavailable · saved on this device')
      setLoaded(userId)
    })}
    pull()
    window.addEventListener('online',pull)
    return ()=>{active=false;window.removeEventListener('online',pull)}
  },[userId])
  useEffect(()=>{
    if(scope!==userId)return
    if(!userId){persist('cma-guest',workspace);return}
    persist('cma-account:'+userId,workspace)
    if(loaded!==userId||!client)return
    const db=client
    let active=true
    const synchronize=()=>{void db.rpc('save_academy_state',{new_profile:{...profile,updatedAt:profileAt},new_events:events,new_repertoire:entries}).then(({error})=>{
      if(active)setSync(error?'Cloud unavailable · saved on this device':'Progress synchronized')
    })}
    const timer=setTimeout(synchronize,750)
    window.addEventListener('online',synchronize)
    return ()=>{active=false;clearTimeout(timer);window.removeEventListener('online',synchronize)}
  },[workspace,userId,scope,loaded,profile,events,entries,profileAt])
  useEffect(()=>{
    const query=matchMedia('(prefers-color-scheme: dark)')
    const apply=()=>{document.documentElement.dataset.theme=profile.theme==='system'?(query.matches?'dark':'light'):profile.theme}
    apply();query.addEventListener('change',apply)
    document.documentElement.dataset.board=profile.board
    document.documentElement.dataset.contrast=String(profile.contrast)
    document.documentElement.dataset.motion=String(profile.motion)
    return ()=>query.removeEventListener('change',apply)
  },[profile])
  const proofKey='cma-proof:'+userId
  async function flushProofs(){
    if(!userId||!client||!navigator.onLine)return
    const pending=read<Record<string,string[]>>(proofKey,{})
    for(const [id,moves] of Object.entries(pending).slice(0,40)){
      const {error}=await client.rpc('record_verified_puzzle',{puzzle:id,proof:moves})
      if(error)return
      const current=read<Record<string,string[]>>(proofKey,{})
      if(JSON.stringify(current[id])===JSON.stringify(moves)){delete current[id];persist(proofKey,current)}
    }
  }
  useEffect(()=>{
    if(!userId)return
    void flushProofs()
    const trigger=()=>void flushProofs()
    window.addEventListener('online',trigger)
    return ()=>window.removeEventListener('online',trigger)
  // Rebind the proof queue when the account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId])
  function add(kind:EventKind,id:string,title:string,score=100,detail?:string) {
    const key=kind+':'+id
    setWorkspace(previous=>{
      const old=previous.events.find(e=>e.key===key)
      if(old&&(key.startsWith('record:puzzle-rating:')||kind!=='opening'&&old.score>=score))return previous
      return {...previous,events:[...previous.events.filter(e=>e.key!==key),{key,kind,title,at:new Date().toISOString(),score,xp:awards[kind],detail}]}
    })
  }
  const visible=scope===userId?workspace:(!userId?guest():account(userId))
  return <Context.Provider value={{
    profile:visible.profile,events:visible.events,entries:visible.entries.filter(e=>!e.removed),session,role:scope===userId?role:'student',sync,
    xp:visible.events.reduce((sum,e)=>sum+(awards[e.kind]??0),0),add,
    update:patch=>setWorkspace(w=>({...w,profile:{...w.profile,...patch},profileAt:new Date().toISOString()})),
    save:entry=>setWorkspace(w=>({...w,entries:[...w.entries.filter(x=>x.id!==entry.id),{...entry,updatedAt:new Date().toISOString(),removed:false}]})),
    remove:id=>setWorkspace(w=>({...w,entries:w.entries.map(entry=>entry.id===id?{...entry,updatedAt:new Date().toISOString(),removed:true}:entry)})),
    verifyPuzzle:(id,moves)=>{if(userId&&client){persist(proofKey,{...read(proofKey,{}),[id]:moves});void flushProofs()}}
  }}>{children}</Context.Provider>
}
export function useProgress() {const state=useContext(Context);if(!state)throw new Error('ProgressProvider required');return state}
