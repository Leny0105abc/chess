import seed from './openings.json'
import { line, initialFen, moveNote } from '../chess'
import { slug } from './courses'
import type { Level } from '../progress'

export type Variation={id:string;name:string;eco:string|null;moves:string[];recordedPlies:number;source:string|null}
export type Opening={id:string;name:string;category:string;level:Level;white:string;black:string;mistake:string;gambit:boolean;speculative:boolean;variations:Variation[]}
export const openingFamilies:Opening[]=seed.map(f=>({...f,id:slug(f.name),level:f.level as Level,variations:f.variations.map(v=>({...v,id:slug(v.name)}))}))
export const featuredOpening=openingFamilies[0]
export const closedNotes=[
  'White occupies e4, controls d5 and f5, and opens a route for the king’s bishop.',
  'Black occupies e5 and prevents White from dominating the center uncontested.',
  'The g1-knight develops with an attack on e5 and makes kingside castling possible once the bishop moves.',
  'The b8-knight defends e5 and adds control of the central d4 square.',
  'White’s bishop targets the c6-knight, tying it to the defense of e5.',
  'Black questions the bishop and gains room for …b5 later.',
  'The bishop keeps pressure on c6 from a4 and can later retreat to b3.',
  'Black develops the knight toward the center and attacks e4.',
  'White shelters the king and brings the rook closer to the open central files.',
  'The bishop develops quietly and clears f8 so Black can castle.',
  'White reinforces e4 with the rook, freeing the queen’s knight to develop later.',
  'Black gains queenside space and sends the a4-bishop back along its diagonal.',
  'The bishop returns to b3, where it eyes f7 and stays clear of the a-pawn.',
  'Black reinforces e5 with the d-pawn and gives the c8-bishop a route out.',
  'White prepares d4 and leaves c2 as a retreat square for the bishop.',
  'Black secures the king and frees the f8-rook for the central struggle.',
  'White takes away g4 from the black bishop and creates h2 as an escape square for the king.',
  'The c6-knight retreats, clearing the c-pawn and preparing to regroup on d7.',
  'White builds a two-pawn center and challenges the e5-pawn directly.',
  'The knight returns via d7, supports e5, and keeps c6 available for the pawn.'
]
export function openingNotes(opening:Opening,variation:Variation) {
  if(opening.id==='ruy-lopez'&&variation.id==='closed-variation')return closedNotes
  return line(initialFen,variation.moves).history.map(moveNote)
}
