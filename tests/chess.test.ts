import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { initialFen, line, parsePgn, play, result, validPosition } from '../src/chess'
import { alternativesInOne, afterMateCandidate, dailyPuzzle, puzzles } from '../src/data/puzzles'

test('illegal moves are rejected, including moves that leave the king checked',()=>{
  const game=new Chess()
  assert.throws(()=>play(game,'e2e5'))
  assert.equal(game.fen(),initialFen)
  const checked=new Chess('4k3/8/8/8/8/8/7P/r3K3 w - - 0 1')
  assert.equal(checked.isCheck(),true)
  assert.throws(()=>play(checked,'h3'))
})
test('castling, en passant, and promotion work on valid boards',()=>{
  assert.equal(line('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['O-O']).game.get('f1')?.type,'r')
  assert.equal(line('4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 2',['dxe6']).game.get('e5'),undefined)
  assert.equal(line('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',['a8=N']).game.get('a8')?.type,'n')
  assert.throws(()=>line('r3kr1r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['O-O']))
  assert.throws(()=>validPosition('4k3/8/8/8/8/8/8/4K3 w K - 0 1'),/Castling rights/)
  assert.throws(()=>validPosition('4k3/8/8/3P4/8/8/8/4K3 w - e6 0 1'),/en passant/)
})
test('checkmate, stalemate and threefold repetition are distinct',()=>{
  assert.match(result(line(initialFen,['f3','e5','g4','Qh4#']).game),/Black wins by checkmate/)
  assert.match(result(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')),/stalemate/)
  assert.match(result(line(initialFen,['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']).game),/repetition/)
  assert.match(result(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1')),/insufficient/)
})
test('replay and undo preserve exact positions and PGN round-trips',()=>{
  const {game,history}=line(initialFen,['e4','e5','Nf3','Nc6'])
  game.undo();assert.equal(game.fen(),history[2].after)
  play(game,history[3].lan);assert.equal(game.fen(),history[3].after)
  assert.equal(line(initialFen,parsePgn(game.pgn()).moves).game.fen(),game.fen())
  assert.throws(()=>parsePgn(' '.repeat(128001)),/128 KB/)
  assert.throws(()=>validPosition('4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1'),/check/)
})
test('all mate in one solutions are accepted and a daily puzzle is stable',()=>{
  const fen='7k/8/6K1/5Q2/8/8/8/8 w - - 0 1'
  const answers=alternativesInOne(fen)
  assert.ok(answers.length>=2)
  assert.ok(answers.every(move=>afterMateCandidate(line(fen,[move]).game,0)))
  const today=new Date(2026,10,12,0)
  assert.equal(dailyPuzzle(today).id,dailyPuzzle(new Date(2026,10,12,23)).id)
  assert.ok(puzzles.length>=300)
})

test('level completion requires one complete learning path',async()=>{
  const [{achievements},{lessons}]=await Promise.all([import('../src/data/achievements'),import('../src/data/courses')])
  const badge=achievements.find(item=>item.name==='Level Completion')!
  const records=(ids:string[])=>ids.map(id=>({key:'lesson:'+id,kind:'lesson' as const,title:id,at:'2026-11-12T09:00:00Z',score:100,xp:40}))
  assert.equal(badge.test(records(lessons.slice(1,26).map(lesson=>lesson.id))),false)
  assert.equal(badge.test(records(lessons.slice(0,25).map(lesson=>lesson.id))),true)
})
