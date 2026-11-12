import seed from './puzzles.json'
import { Chess } from 'chess.js'
import { line, moveNote, pieceNames, play, uci } from '../chess'

export type Puzzle={id:string;fen:string;moves:string[];rating:number;themes:string[];url:string;alternatives?:string[][]}
export const puzzles: Puzzle[]=seed
export const puzzleLevels=['Beginner','Intermediate','Advanced','Expert'] as const
export function puzzleLevel(rating:number) {return puzzleLevels[rating<1200?0:rating<1600?1:rating<2000?2:3]}
const themeNotes:Record<string,[string,string]>={
  mateIn1:['Mate in 1','Find a check that takes away every legal reply.'],
  mateIn2:['Mate in 2','Look for a forcing first move that sets up mate on your second move.'],
  mateIn3:['Mate in 3','Calculate three moves for your side. Compare the defender’s replies before committing.'],
  mateIn4:['Mate in 4','Build a forcing sequence and check every king escape and interposition.'],
  fork:['Fork','Look for a piece that can attack two targets from one square.'],
  pin:['Pin','Find a piece whose movement would expose a more valuable target.'],
  skewer:['Skewer','Look for two opposing pieces along a file, rank, or diagonal.'],
  discoveredAttack:['Discovered attack','Move a piece out of the path of a hidden line attacker.'],
  doubleCheck:['Double check','Can moving one piece uncover a check while giving a second check?'],
  deflection:['Deflection','Find a defender that can be pulled away from its job.'],
  attraction:['Decoy','Find a forcing move that lures an enemy piece onto a vulnerable square.'],
  capturingDefender:['Remove the defender','Identify what protects the target and calculate a way to capture it.'],
  intermezzo:['In-between move','Before recapturing, look for a forcing move that changes the sequence.'],
  backRankMate:['Back-rank mate','Look at the king’s escape squares along the back rank.'],
  smotheredMate:['Smothered mate','Check whether a knight can attack a king boxed in by its own pieces.'],
  sacrifice:['Sacrifice','Consider a material offer if it opens a line or creates a forcing threat.'],
  promotion:['Promotion','Calculate the promotion race and consider every promotion piece.'],
  endgame:['Endgame tactics','Compare the activity of the kings and the speed of any passed pawns.'],
  defensiveMove:['Defensive tactics','Identify the opponent’s strongest immediate threat and neutralize it actively.'],
  opening:['Opening tactics','Look for a tactical consequence of a king or piece that has yet to develop.'],
  advantage:['Winning material','Compare checks and captures, then verify the best reply for the defender.'],
  crushing:['Decisive advantage','Look for a forcing sequence that converts your most active pieces into a concrete gain.'],
  quietMove:['Quiet move','Consider a non-checking move that builds a threat the opponent cannot meet.'],
  queenEndgame:['Queen endgame','Check both sides’ forcing checks and promotion threats.'],
  bishopEndgame:['Bishop endgame','Trace the bishops’ diagonals and look for pawn races.'],
  pawnEndgame:['Pawn endgame','Count tempi and check for opposition or a breakthrough.'],
  knightEndgame:['Knight endgame','Calculate the knight’s route and the passer’s exact promotion time.'],
  rookEndgame:['Rook endgame','Look for checks, cutoffs, and a way to get behind a passed pawn.'],
  hangingPiece:['Hanging piece','Look for an undefended piece and verify that taking it is safe.'],
  trappedPiece:['Trapped piece','Check which enemy piece has few safe retreat squares.']
}
export const puzzleThemes=Object.entries(themeNotes).map(([id,[name]])=>({id,name}))
export function primaryTheme(p:Puzzle) {return p.themes.find(t=>themeNotes[t])??'advantage'}
export function themeName(theme:string) {return themeNotes[theme]?.[0]??theme}
export function puzzleHint(p:Puzzle) {return themeNotes[primaryTheme(p)]?.[1]??themeNotes.advantage[1]}
export function puzzleExplanation(p:Puzzle) {
  const {history,game}=line(p.fen,p.moves)
  const san=history.map(m=>m.san).join(' ')
  const capture=history.filter((_,i)=>i%2===0).filter(m=>m.captured).at(-1)
  return moveNote(history[0],0)+' The recorded line runs '+san+'. '+(game.isCheckmate()?'The final check leaves no legal reply.':capture?'The attacking side takes the '+pieceNames[capture.captured!]+' on '+capture.to+'.':'The final position shows the resulting activity and threats; replay it in analysis to compare other defenses.')
}
export function mateWithin(game:Chess,plies:number):boolean {
  if(plies<1)return false
  const moves=game.moves()
  if(!moves.length)return false
  return moves.some(first=>{
    game.move(first)
    const value=afterMateCandidate(game,plies-1)
    game.undo()
    return value
  })
}
export function afterMateCandidate(game:Chess,plies:number):boolean {
  if(game.isCheckmate())return true
  if(plies<2||game.isDraw())return false
  const replies=game.moves()
  return replies.every(reply=>{game.move(reply);const result=mateWithin(game,plies-1);game.undo();return result})
}
export function alternativesInOne(fen:string) {
  const game=new Chess(fen)
  return game.moves({verbose:true}).filter(move=>move.san.endsWith('#')).map(uci)
}
export function puzzlePosition(p:Puzzle, index:number){return line(p.fen,p.moves.slice(0,index)).game}
export function startsWithMate(fen:string, move:string) {const g=new Chess(fen);play(g,move);return g.isCheckmate()}
export function dailyPuzzle(date=new Date()) {
  const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86_400_000)
  const pool=puzzles.filter(p=>p.rating>=950&&p.rating<1650&&p.themes.includes('mateIn2'))
  return (pool.length?pool:puzzles)[day%(pool.length||puzzles.length)]
}
