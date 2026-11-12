import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import { Chess } from 'chess.js'
const directory=process.argv[2]??'.cache'
const engineDir='node_modules/stockfish/src'
const script=(await readdir(engineDir)).find(name=>name.includes('lite-single')&&name.endsWith('.js'))
const engine=spawn(process.execPath,[engineDir+'/'+script],{stdio:['pipe','pipe','inherit']})
const io=createInterface({input:engine.stdout})
const stream=io[Symbol.asyncIterator]()
const send=command=>engine.stdin.write(command+'\n')
async function until(prefix){
  while(true){
    const {value,done}=await stream.next()
    if(done)throw new Error('Stockfish ended unexpectedly')
    if(value.startsWith(prefix))return value
  }
}
const rows=[]
for(const letter of 'abcde'){
  const tsv=await readFile(directory+'/'+letter+'.tsv','utf8')
  for(const row of tsv.trim().split(/\r?\n/).slice(1)){
    const [eco,name,pgn]=row.split('\t')
    const moves=pgn.replace(/\d+\.\s*/g,'').split(' ').filter(Boolean)
    rows.push({eco,name,moves})
  }
}
const gambits=new Set(["King's Gambit",'Danish Gambit','Evans Gambit','Benko Gambit','Budapest Gambit','Englund Gambit','Blackmar-Diemer Gambit'])
const risks=new Set(['Danish Gambit','Englund Gambit','Blackmar-Diemer Gambit',"King's Gambit"])
const families=[]
try{
  send('uci');await until('uciok');send('isready');await until('readyok')
  const src=await readFile('scripts/opening-seeds.txt','utf8')
  for(const row of src.trim().split(/\r?\n/)){
    if(!row.startsWith('>')){
      const [name,category,level,white,black,mistake]=row.split('|')
      families.push({name,category,level,white,black,mistake,gambit:gambits.has(name),speculative:risks.has(name),variations:[]})
      continue
    }
    const family=families.at(-1)
    const [name,movesText]=row.slice(1).split(':')
    const game=new Chess()
    try{for(const san of movesText.split(' '))game.move(san,{strict:true})}catch(e){throw new Error(family.name+' '+name+' '+e.message)}
    const prefix=game.history()
    const same=(moves,start)=>start.every((move,i)=>moves[i]===move)
    const extension=rows.filter(r=>r.moves.length>=20&&same(r.moves,prefix)).sort((a,b)=>b.moves.length-a.moves.length)[0]
    if(extension&&name!=='Closed Variation'){
      for(const san of extension.moves.slice(prefix.length,Math.max(20,Math.min(30,extension.moves.length))))game.move(san,{strict:true})
    }
    const recordedPlies=game.history().length
    send('ucinewgame')
    while(game.history().length<20&&!game.isGameOver()){
      send('position fen '+game.fen())
      send('go depth 6')
      const move=(await until('bestmove ')).split(' ')[1]
      game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]})
    }
    if(game.history().length<20)throw new Error(family.name+' '+name+' ended before twenty half-moves')
    const continuation=game.history()
    const matching=rows.filter(r=>same(continuation,r.moves)).sort((a,b)=>b.moves.length-a.moves.length)
    const familyMatch=matching.find(r=>r.name.toLowerCase().startsWith(family.name.toLowerCase()))
    if(!family.variations.length)console.log('Validated '+family.name)
    family.variations.push({name,eco:familyMatch?.eco??matching[0]?.eco??null,moves:game.history(),recordedPlies,source:extension?.name??null})
  }
}finally{send('quit');io.close()}
await writeFile(process.argv[3]??'src/data/openings.json',JSON.stringify(families,null,1)+'\n')
console.log(families.length+' opening families, '+families.reduce((sum,f)=>sum+f.variations.length,0)+' variations')
