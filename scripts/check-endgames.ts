import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFileSync } from 'node:fs'
import { endgames } from '../src/data/courses'
import { line, uci } from '../src/chess'

const exec=promisify(execFile)
type Tablebase={category:string;moves:{uci:string;san:string;category:string}[]}
const results:Record<string,{category:string;after:string}>={}
for(let i=0;i<endgames.length;i+=4){
  const checks=await Promise.all(endgames.slice(i,i+4).map(async lesson=>{
    const fen=new URLSearchParams({fen:lesson.fen})
    const {stdout}=await exec('curl',['-fsS','--max-time','12','https://tablebase.lichess.ovh/standard?'+fen])
    const tablebase=JSON.parse(stdout) as Tablebase
    const move=line(lesson.fen,lesson.moves).history[0]
    const result=tablebase.moves.find(candidate=>candidate.uci===uci(move))
    if(!result)throw new Error(lesson.title+' move is absent from the tablebase.')
    return {lesson,tablebase,result}
  }))
  for(const {lesson,tablebase,result} of checks){
    results[lesson.id]={category:tablebase.category,after:result.category}
    console.log(lesson.title,tablebase.category,result.san,'→',result.category,tablebase.moves.slice(0,3).map(m=>m.san+':'+m.category).join(' '))
  }
}
writeFileSync('src/data/endgame-tablebase.json',JSON.stringify(results,null,2)+'\n')
