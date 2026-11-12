export type Evaluation={best:string;cp?:number;mate?:number;pv:string[];depth:number}
const engineFile='/engine/stockfish-17.1-lite-single-03e3232.js'
type Search={fen:string;depth?:number;skill?:number;count?:number;signal?:AbortSignal;moves?:string[];restrict?:string}
export async function evaluate({fen,depth=10,skill=20,count=1,signal,moves,restrict}:Search):Promise<Evaluation[]> {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Canceled','AbortError'));return}
    const worker=new Worker(engineFile)
    const variations=new Map<number,Evaluation>()
    const close=()=>{worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
    const fail=(error:Error)=>{close();reject(error)}
    const cancel=()=>fail(new DOMException('Canceled','AbortError'))
    const timer=window.setTimeout(()=>fail(new Error('Stockfish took too long to respond. Try a lower search depth.')),18000)
    signal?.addEventListener('abort',cancel,{once:true})
    const send=(command:string)=>worker.postMessage(command)
    worker.onerror=()=>fail(new Error('Stockfish could not start. Check your connection and try again.'))
    worker.onmessage=({data}:MessageEvent<string>)=>{
      for(const line of String(data).split('\n')){
        if(line.startsWith('uciok')){
          send('setoption name Skill Level value '+skill);send('setoption name MultiPV value '+count);send('setoption name Hash value 16');send('isready')
        }else if(line.startsWith('readyok')){
          send('position fen '+fen+(moves?.length?' moves '+moves.join(' '):''))
          send('go depth '+depth+(restrict?' searchmoves '+restrict:''))
        }else if(line.startsWith('info depth')){
          const parsed=/depth (\d+).*?multipv (\d+) score (cp|mate) (-?\d+).*? pv (.+)$/.exec(line)
          if(parsed){
            const [,d,rank,type,value,pv]=parsed
            const sequence=pv.trim().split(' ')
            variations.set(Number(rank),{best:sequence[0],cp:type==='cp'?Number(value):undefined,mate:type==='mate'?Number(value):undefined,pv:sequence,depth:Number(d)})
          }
        }else if(line.startsWith('bestmove')){
          const best=line.split(' ')[1]
          const list=[...variations].sort(([a],[b])=>a-b).map(([,value])=>value)
          if(list.length)list[0].best=best
          close();resolve(list.length?list:best==='(none)'||best==='0000'?[]:[{best,pv:[best],depth}]);return
        }
      }
    }
    send('uci')
  })
}
export function numeric(result:Evaluation|undefined) {
  if(result?.mate!==undefined)return result.mate>0?10000-result.mate:result.mate<0?-10000-result.mate:-10000
  return result?.cp??0
}
export function scoreLabel(result:Evaluation,whiteFactor=1) {
  return result.mate!==undefined?(result.mate===0?'#0':(result.mate*whiteFactor<0?'−':'')+'M'+Math.abs(result.mate)):
    new Intl.NumberFormat('en',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'}).format((result.cp??0)*whiteFactor/100)
}
export function classification(loss:number) {
  return loss<=10?'Best Move':loss<=25?'Excellent':loss<=60?'Good':loss<=120?'Inaccuracy':loss<=250?'Mistake':'Blunder'
}
