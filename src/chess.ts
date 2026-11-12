import { Chess, type Move, type Square } from 'chess.js'

export type Arrow = { from: Square; to: Square; color?: string }
export type InputMove = { from: Square; to: Square; promotion?: string }
export const initialFen = new Chess().fen()
export const pieceNames = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' }
export const colorName = (color: string) => color === 'w' ? 'White' : 'Black'
export const uci = (move: Move) => move.from + move.to + (move.promotion ?? '')
export function play(game: Chess, move: string | InputMove) {
  if (typeof move === 'string' && /^[a-h][1-8][a-h][1-8][nbrq]?$/.test(move)) {
    return game.move({from: move.slice(0,2), to: move.slice(2,4), promotion: move[4]})
  }
  return game.move(move)
}
export function line(fen: string, moves: readonly string[]) {
  const game = new Chess(fen)
  const history = moves.map(move => play(game, move))
  return {game, history}
}
export function parsePgn(pgn: string) {
  if (new TextEncoder().encode(pgn).length > 128_000) throw new Error('PGN must be smaller than 128 KB.')
  const game = new Chess()
  game.loadPgn(pgn)
  const history = game.history({verbose:true})
  if (history.length > 600) throw new Error('PGN must contain at most 600 half-moves.')
  return {fen:validPosition(history[0]?.before ?? game.fen()), moves:history.map(uci), comments:game.getComments(), headers:game.getHeaders()}
}
export function result(game: Chess) {
  if (game.isCheckmate()) return colorName(game.turn() === 'w' ? 'b' : 'w') + ' wins by checkmate'
  if (game.isStalemate()) return 'Draw by stalemate'
  if (game.isThreefoldRepetition()) return 'Draw by repetition'
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (game.isDraw()) return 'Draw'
  return colorName(game.turn()) + ' to move' + (game.isCheck() ? ' · Check' : '')
}
export function moveNote(move: Move, halfMove: number) {
  const side = colorName(move.color)
  const name = pieceNames[move.piece]
  if (move.san.endsWith('#')) return side + ' delivers checkmate with ' + move.san.replace('#','') + '.'
  if (move.san.startsWith('O-O')) return side + ' castles ' + (move.san.startsWith('O-O-O') ? 'queenside' : 'kingside') + ', sheltering the king and bringing the rook toward the center.'
  if (move.promotion) return side + ' promotes on ' + move.to + ' to a ' + pieceNames[move.promotion] + '.'
  if (move.captured) {
    const previous = new Chess(move.before).get(move.to)
    return 'The ' + name + ' on ' + move.from + ' captures the ' + colorName(previous?.color ?? (move.color === 'w' ? 'b':'w')).toLowerCase() + ' ' + pieceNames[move.captured] + ' on ' + move.to + (move.san.includes('+') ? ' with check.' : ', changing the material balance on that square.')
  }
  const after = new Chess(move.after)
  const attacks = after.attackers('e4',move.color).includes(move.to) ? 'e4' : after.attackers('d5',move.color).includes(move.to) ? 'd5' : after.attackers('d4',move.color).includes(move.to) ? 'd4' : after.attackers('e5',move.color).includes(move.to) ? 'e5' : ''
  if (move.san.includes('+')) return side + ' gives check by placing the ' + name + ' on ' + move.to + ', so the reply must deal with the king threat.'
  if (move.piece === 'p') {
    if ('de'.includes(move.to[0])) return side + ' advances the ' + move.to[0] + '-pawn to ' + move.to + ' to take space in the center' + (attacks ? ' and control ' + attacks : '') + '.'
    if (move.to === 'g3' || move.to === 'b3' || move.to === 'g6' || move.to === 'b6') return side + ' moves the ' + move.to[0] + '-pawn to ' + move.to + ', opening a fianchetto square for the bishop.'
    return 'The ' + move.to[0] + '-pawn moves to ' + move.to + (attacks ? ' and adds control of ' + attacks : ', changing the available squares on that wing') + '.'
  }
  if (attacks) return 'The ' + name + ' moves to ' + move.to + ' where it adds pressure on ' + attacks + '.'
  if (halfMove < 20 && move.from[1] === (move.color === 'w' ? '1':'8')) return side + ' develops the ' + name + ' from ' + move.from + ' to ' + move.to + ', freeing its starting square.'
  return side + ' repositions the ' + name + ' from ' + move.from + ' to ' + move.to + (after.attackers(move.to,move.color).length ? ' where another piece protects it.' : '. Look for how the opponent can contest that square.')
}
export function validPosition(fen: string) {
  const g = new Chess(fen)
  const board=g.board().flat()
  if (board.some((piece, index) => piece?.type === 'p' && (index < 8 || index > 55))) throw new Error('A pawn cannot stand on the first or eighth rank.')
  for (const color of ['w','b'] as const) {
    const opposite = color === 'w' ? 'b' : 'w'
    const pieces=board.filter(piece=>piece?.color===color)
    if(pieces.length>16||pieces.filter(piece=>piece?.type==='p').length>8)throw new Error('Too many pieces for '+colorName(color)+'.')
    const king = pieces.find(piece => piece?.type === 'k')
    if (!king || (g.turn() !== color && g.isAttacked(king.square,opposite))) throw new Error('The side that just moved cannot be in check.')
  }
  const [, , rights='-', ep='-']=fen.trim().split(/\s+/)
  for(const right of rights.replace('-','')){
    const color=right===right.toUpperCase()?'w':'b'
    const rank=color==='w'?'1':'8'
    const king=g.get(('e'+rank) as Square)
    const rook=g.get(((right.toLowerCase()==='k'?'h':'a')+rank) as Square)
    if(king?.type!=='k'||king.color!==color||rook?.type!=='r'||rook.color!==color)throw new Error('Castling rights require the king and rook on their starting squares.')
  }
  if(ep!=='-'){
    const next=g.turn()
    const pawn=g.get((ep[0]+(next==='w'?'5':'4')) as Square)
    const origin=g.get((ep[0]+(next==='w'?'7':'2')) as Square)
    if(ep[1]!== (next==='w'?'6':'3')||pawn?.type!=='p'||pawn.color===next||origin||g.get(ep as Square))throw new Error('Invalid en passant target.')
  }
  return g.fen()
}
