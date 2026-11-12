import { createClient } from 'npm:@supabase/supabase-js@2'
import { Chess } from 'npm:chess.js@1.4.0'

const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
function respond(value:unknown,status=200) {
  return new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}})
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(request.method!=='POST')return respond({error:'Use POST.'},405)
  const token=request.headers.get('Authorization')??''
  const url=Deno.env.get('SUPABASE_URL')!
  const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}}})
  const {data:{user}}=await userClient.auth.getUser()
  if(!user)return respond({error:'Sign in first.'},401)
  const {data:role}=await userClient.rpc('academy_role')
  if(role!=='admin')return respond({error:'Administrator access required.'},403)
  const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try{
    const body=await request.text()
    if(new TextEncoder().encode(body).byteLength>60_000)return respond({error:'Content exceeds 60 KB.'},413)
    const {id,action,kind,title,fen,moves,notes,published}=JSON.parse(body)
    if(id!==undefined&&(typeof id!=='string'||!(/^[a-f0-9-]{36}$/i.test(id))))throw new Error('Invalid content identifier.')
    if(action==='delete'&&id){
      const {error}=await db.from('academy_catalog').delete().eq('id',id)
      if(error)throw error
      return respond({ok:true})
    }
    if(!['opening','puzzle','lesson','endgame'].includes(kind)||typeof title!=='string'||!title.trim()||title.length>100)throw new Error('Set a valid title and content type.')
    if(typeof fen!=='string'||fen.length>150)throw new Error('Set a valid FEN.')
    const game=new Chess(fen)
    if(game.board().flat().some((p,i)=>p?.type==='p'&&(i<8||i>55)))throw new Error('A pawn cannot stand on the first or eighth rank.')
    const previous=game.turn()==='w'?'b':'w'
    const king=game.board().flat().find(p=>p?.type==='k'&&p.color===previous)
    if(!king||game.isAttacked(king.square,game.turn()))throw new Error('The side that just moved is in check.')
    if(!Array.isArray(moves)||!moves.length||moves.length>200)throw new Error('Add between 1 and 200 legal half-moves.')
    if(kind==='opening'&&moves.length<20)throw new Error('Opening variations require at least 20 half-moves.')
    const clean=moves.map(move=>{
      if(typeof move!=='string'||move.length>10)throw new Error('Invalid move notation.')
      const result=/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)?game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}):game.move(move,{strict:true})
      return result.san
    })
    if(!Array.isArray(notes)||notes.length!==moves.length||notes.some(note=>typeof note!=='string'||note.length>700||published&&!note.trim()))throw new Error('Published content needs an explanation for every half-move.')
    if(kind==='puzzle'&&!game.isCheckmate())throw new Error('Custom puzzles must end in checkmate in the recorded solution.')
    const record={kind,title:title.trim(),fen:new Chess(fen).fen(),moves:clean,notes,author_id:user.id,published:published===true,updated_at:new Date().toISOString()}
    const operation=id?db.from('academy_catalog').update(record).eq('id',id):db.from('academy_catalog').insert(record)
    const {data,error}=await operation.select('id').single()
    if(error)throw error
    return respond(data)
  }catch(reason){return respond({error:(reason as Error).message},400)}
})
