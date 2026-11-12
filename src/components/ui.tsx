import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Maximize, Repeat2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Heading({title,description,back,children}: {title:string;description?:string;back?:{to:string;label:string};children?:ReactNode}) {
  return <header className="page-heading">{back&&<Link className="back-link" to={back.to}><ArrowLeft size={16}/>{back.label}</Link>}<div className="heading-row"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</div></header>
}
export function Empty({children}: {children:ReactNode}) { return <div className="card empty">{children}</div> }
export function Meter({value,label}: {value:number;label:string}) {return <div className="meter" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><span style={{width:Math.min(100,Math.max(0,value))+'%'}}/></div>}
export function Controls({cursor,max,change,flip,full,children}: {cursor:number;max:number;change:(n:number)=>void;flip:()=>void;full:()=>void;children?:ReactNode}) {
  return <div className="controls">
    <button className="icon-button" title="First move" aria-label="First move" disabled={cursor===0} onClick={()=>change(0)}><ChevronFirst size={19}/></button>
    <button className="icon-button" title="Previous move" aria-label="Previous move" disabled={cursor===0} onClick={()=>change(cursor-1)}><ChevronLeft size={19}/></button>
    {children}
    <button className="icon-button" title="Next move" aria-label="Next move" disabled={cursor===max} onClick={()=>change(cursor+1)}><ChevronRight size={19}/></button>
    <button className="icon-button" title="Last move" aria-label="Last move" disabled={cursor===max} onClick={()=>change(max)}><ChevronLast size={19}/></button>
    <span className="controls-spacer"/>
    <button className="icon-button" title="Flip board" aria-label="Flip board" onClick={flip}><Repeat2 size={18}/></button>
    <button className="icon-button" title="Fullscreen board" aria-label="Fullscreen board" onClick={full}><Maximize size={16}/></button>
  </div>
}
export async function fullscreen(element:HTMLElement|null) {
  if(document.fullscreenElement){await document.exitFullscreen();return}
  if(element?.requestFullscreen) await element.requestFullscreen().catch(()=>element.classList.toggle('expanded-board'))
  else element?.classList.toggle('expanded-board')
}
export function downloadFile(name:string, contents:string, type='text/plain') {
  const url=URL.createObjectURL(new Blob([contents],{type}))
  const anchor=document.createElement('a')
  anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
