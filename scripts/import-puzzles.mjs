import { createReadStream, readFileSync, openSync, readSync, closeSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createZstdDecompress } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Chess } from 'chess.js'

const path=process.argv[2]
if(!path) throw new Error('Usage: node scripts/import-puzzles.mjs <Lichess .csv or .csv.zst>')
const header=Buffer.alloc(8)
const fd=openSync(path,'r')
let offset=0
while(readSync(fd,header,0,8,offset)===8&&(header.readUInt32LE(0)>>>4)===0x184d2a5) offset+=8+header.readUInt32LE(4)
closeSync(fd)
const input=createReadStream(path,{start:offset})
const stream=path.endsWith('.zst')?input.pipe(createZstdDecompress()):input
const reader=createInterface({input:stream})
const themes=['mateIn1','mateIn2','mateIn3','mateIn4','fork','pin','skewer','discoveredAttack','doubleCheck','deflection','attraction','capturingDefender','intermezzo','backRankMate','smotheredMate','sacrifice','promotion','endgame','defensiveMove','opening','advantage','crushing','quietMove','queenEndgame','bishopEndgame','pawnEndgame','knightEndgame','rookEndgame','hangingPiece','trappedPiece']
const bins=new Map(themes.map(theme=>[theme,[[],[],[],[]]]))
const seen=new Set()
const play=(game,move)=>game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]})
try {
  for await(const row of reader){
    const [id,sourceFen,moves,ratingText,,popularity,,tags,url]=row.split(',')
    const rating=Number(ratingText)
    if(!id||!url||Number(popularity)<75||rating<550||rating>2800)continue
    const ply=moves.split(' ')
    if(ply.length<2||ply.length>14)continue
    const tier=rating<1200?0:rating<1600?1:rating<2000?2:3
    const tagsList=tags.split(' ')
    const groups=tagsList.filter(theme=>bins.has(theme)&&bins.get(theme)[tier].length<12)
    if(!groups.length)continue
    try{
      const game=new Chess(sourceFen)
      play(game,ply[0])
      const fen=game.fen()
      const key=fen.split(' ').slice(0,4).join(' ')
      if(seen.has(key))continue
      for(const move of ply.slice(1))play(game,move)
      if(tagsList.includes('mate')&&!game.isCheckmate())continue
      const puzzle={id,fen,moves:ply.slice(1),rating,themes:tagsList,url}
      for(const group of groups)bins.get(group)[tier].push(puzzle)
      seen.add(key)
    }catch{/* ignore malformed source rows */}
    if([...bins.values()].flat().every(bin=>bin.length>=12))break
  }
}catch(error){
  if(error.code!=='Z_BUF_ERROR')throw error
  console.log('Selected from a partial public export.')
}finally{
  reader.close()
  input.destroy()
}
const selected=new Map()
for(let i=0;i<12&&selected.size<360;i++){
  for(const theme of themes)for(const bucket of bins.get(theme)){
    if(bucket[i]&&selected.size<360)selected.set(bucket[i].id,bucket[i])
  }
}
if(selected.size<300)throw new Error('Found '+selected.size+' puzzles; use a larger slice of the export.')
await writeFile('src/data/puzzles.json',JSON.stringify([...selected.values()].sort((a,b)=>a.rating-b.rating),null,1)+'\n')
console.log('Wrote '+selected.size+' distinct puzzles. Themes: '+themes.filter(t=>[...selected.values()].some(p=>p.themes.includes(t))).join(', '))
