import { Chess } from 'chess.js'
import { initialFen, line, play, uci, validPosition } from '../src/chess'
import { endgames, lessons } from '../src/data/courses'
import { openingFamilies, openingNotes } from '../src/data/openings'
import { puzzles, alternativesInOne } from '../src/data/puzzles'
import { writeFileSync } from 'node:fs'

const errors:string[]=[]
const seen=new Set<string>()
const keys:{id:string;answers:string[][]}[]=[]
const check=(label:string,test:()=>void)=>{
  try{test()}catch(error){errors.push(label+': '+(error as Error).message)}
}
const need=(condition:unknown,error:string)=>{if(!condition)throw new Error(error)}
function validateLine(fen:string,moves:string[]){
  validPosition(fen)
  need(moves.length,'No moves')
  const {history,game}=line(fen,moves)
  for(const move of history){
    need(play(new Chess(move.before),uci(move)).after===move.after,'UCI / FEN mismatch at '+move.san)
    need(new Chess(move.before).move(move.san,{strict:true}).after===move.after,'SAN / FEN mismatch at '+move.san)
  }
  return {history,game}
}
for(const puzzle of puzzles)check('Puzzle '+puzzle.id,()=>{
  const {game}=validateLine(puzzle.fen,puzzle.moves)
  need(!seen.has(puzzle.fen.split(' ').slice(0,4).join(' ')),'Duplicate position')
  seen.add(puzzle.fen.split(' ').slice(0,4).join(' '))
  if(puzzle.themes.includes('mate'))need(game.isCheckmate(),'Mate-tagged puzzle does not finish in mate')
  const answers=[puzzle.moves]
  for(const variation of puzzle.alternatives??[]){
    validateLine(puzzle.fen,variation)
    need(variation[0]!==puzzle.moves[0],'Alternative starts with the recorded first move')
    answers.push(variation)
  }
  if(puzzle.themes.includes('mateIn1'))for(const move of alternativesInOne(puzzle.fen))if(move!==puzzle.moves[0])answers.push([move])
  keys.push({id:puzzle.id,answers})
})
let variationCount=0
for(const opening of openingFamilies)for(const variation of opening.variations)check(opening.name+' / '+variation.name,()=>{
  variationCount++
  need(variation.moves.length>=20,'Fewer than 20 half-moves')
  validateLine(initialFen,variation.moves)
  need(openingNotes(opening,variation).length===variation.moves.length,'A move explanation is missing')
})
for(const lesson of [...lessons,...endgames])check(lesson.title,()=>{
  const sample=puzzles.find(p=>p.themes.includes(lesson.theme==='doubleAttack'?'fork':lesson.theme??'advantage'))
  const moves=lesson.moves.length?lesson.moves:sample?.moves
  const fen=lesson.moves.length?lesson.fen:sample?.fen
  need(moves&&fen,'No matching practice position')
  validateLine(fen!,moves!)
  need(lesson.answer&&lesson.wrong&&lesson.question&&lesson.answer!==lesson.wrong,'Invalid quiz question')
})
need(lessons.length>=75&&endgames.length>=20&&puzzles.length>=300&&openingFamilies.length>=30,'Content minimums have not been met')
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else{
  if(process.argv.includes('--seed')){
    const sql="-- Generated with npm run validate -- --seed\ninsert into public.academy_puzzle_keys(id,answers) values\n"+keys.map(k=>"('"+k.id+"','"+JSON.stringify(k.answers)+"'::jsonb)").join(',\n')+"\non conflict(id) do update set answers=excluded.answers;\n"
    writeFileSync('supabase/seed.sql',sql)
  }
  console.log('Validated '+lessons.length+' lessons, '+endgames.length+' endgames, '+variationCount+' opening lines, and '+puzzles.length+' unique puzzles.')
}
