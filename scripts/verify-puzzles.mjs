import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import { Chess } from 'chess.js'

// Fixed-depth checks surface plausible alternatives without claiming exact non-mating evaluations.
const path='src/data/puzzles.json'
const puzzles=JSON.parse(await readFile(path,'utf8'))
const dir='node_modules/stockfish/src'
const entry=(await readdir(dir)).find(name=>name.includes('lite-single')&&name.endsWith('.js'))
const worker=spawn(process.execPath,[dir+'/'+entry],{stdio:['pipe','pipe','inherit']})
const reader=createInterface({input:worker.stdout})
const stream=reader[Symbol.asyncIterator]()
const send=command=>worker.stdin.write(command+'\n')
const depth=Number(process.argv[2]??9)
const play=(game,move)=>game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]})
let accepted=0
async function waitFor(prefix,callback=()=>{}){
  while(true){
    const {value,done}=await stream.next()
    if(done)throw new Error('Stockfish closed the analysis stream')
    if(value.startsWith(prefix))return
    callback(value)
  }
}
try{
  send('uci');await waitFor('uciok')
  send('setoption name MultiPV value 3')
  send('isready');await waitFor('readyok')
  for(const [index,puzzle] of puzzles.entries()){
    if(puzzle.themes.includes('mate'))continue
    send('position fen '+puzzle.fen)
    send('go depth '+depth)
    const evaluations=new Map()
    await waitFor('bestmove ',message=>{
      const match=/^info depth (\d+).*?multipv (\d+) score cp (-?\d+).*? pv (.+)$/.exec(message)
      if(!match||Number(match[1])!==depth)return
      evaluations.set(Number(match[2]),{cp:Number(match[3]),pv:match[4].trim().split(' ')})
    })
    const best=evaluations.get(1)
    const canonical=[...evaluations.values()].find(e=>e.pv[0]===puzzle.moves[0])
    delete puzzle.alternatives
    if(best&&canonical&&best.cp-canonical.cp<=35&&best.cp>=220){
      const alternatives=[...evaluations.values()].filter(e=>e.pv[0]!==puzzle.moves[0]&&e.cp>=Math.max(210,best.cp-30))
        .map(e=>e.pv.slice(0,Math.max(1,Math.min(puzzle.moves.length,e.pv.length-(e.pv.length%2===0?1:0)))))
        .filter(moves=>{
          const game=new Chess(puzzle.fen)
          for(const move of moves)play(game,move)
          return moves.length>0
        })
      if(alternatives.length){puzzle.alternatives=alternatives;accepted+=alternatives.length}
    }
    if(index%75===0)console.log('Checked '+(index+1)+' puzzle positions')
  }
}finally{send('quit');reader.close()}
await writeFile(process.argv[3]??path,JSON.stringify(puzzles,null,1)+'\n')
console.log('Stockfish checked '+puzzles.filter(p=>!p.themes.includes('mate')).length+' non-mate positions and found '+accepted+' similar winning continuations at depth '+depth)
