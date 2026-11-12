import { PGlite } from '@electric-sql/pglite'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const admin='d0000000-0000-0000-0000-000000000001'
const coach='d0000000-0000-0000-0000-000000000002'
const student='d0000000-0000-0000-0000-000000000003'
const stranger='d0000000-0000-0000-0000-000000000004'

test('Postgres migrations isolate student records, restrict roles, and verify leaderboard submissions',async()=>{
  const pg=new PGlite()
  try{
    await pg.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable
        as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
    `)
    await pg.exec(readFileSync('supabase/migrations/202611120001_academy.sql','utf8'))
    await pg.exec(readFileSync('supabase/seed.sql','utf8'))
    for(const id of [admin,coach,student,stranger])await pg.query('insert into auth.users(id) values($1)',[id])
    await pg.query("update public.academy_state set role='admin' where user_id=$1",[admin])
    const role=async(id:string)=>{
      await pg.exec('reset role; set role authenticated')
      await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
    }
    await role(student)
    await assert.rejects(pg.query("select public.set_academy_role($1,'admin')",[student]),/Administrator/)
    await assert.rejects(pg.query("insert into public.academy_classes(name) values('Unauthorized')"),/row-level security/)
    await assert.rejects(pg.query("update public.academy_state set role='admin'"),/permission denied/)
    assert.equal((await pg.query('select user_id from public.academy_state')).rows.length,1)
    await role(admin)
    await pg.query("select public.set_academy_role($1,'coach')",[coach])
    await role(coach)
    const created=await pg.query<{id:string}>("insert into public.academy_classes(name) values('Training group') returning id")
    const classId=created.rows[0].id
    const code=(await pg.query<{code:string}>('select public.academy_class_code($1) as code',[classId])).rows[0].code
    await pg.query("insert into public.academy_assignments(class_id,title,target) values($1,'First move','/learn/introduction-to-chess')",[classId])
    await role(student)
    assert.equal((await pg.query('select id from public.academy_classes')).rows.length,0)
    await pg.query('select public.join_academy_class($1)',[code])
    assert.equal((await pg.query('select id from public.academy_assignments')).rows.length,1)
    assert.equal((await pg.query('select * from public.academy_class_report($1)',[classId])).rows.length,0)
    const report=[{kind:'lesson',key:'lesson:introduction-to-chess',title:'Introduction to chess',xp:9999,score:100,at:'2026-11-12T09:00:00Z'}]
    await pg.query('select public.save_academy_state($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify({name:'Public nickname',public:true}),JSON.stringify(report),'[]'])
    await role(stranger)
    assert.equal((await pg.query('select id from public.academy_assignments')).rows.length,0)
    assert.equal((await pg.query('select * from public.academy_class_report($1)',[classId])).rows.length,0)
    await role(coach)
    const rows=(await pg.query<{display_name:string;events:{xp:number}[]}>('select * from public.academy_class_report($1)',[classId])).rows
    assert.equal(rows[0].display_name,'Public nickname')
    assert.equal(rows[0].events[0].xp,40)
    await pg.exec('reset role')
    const puzzle=(await pg.query<{id:string;answers:string[][]}>('select id,answers from public.academy_puzzle_keys order by id limit 1')).rows[0]
    await role(student)
    const bad=await pg.query<{valid:boolean}>("select public.record_verified_puzzle($1,'[\"a1a2\"]') as valid",[puzzle.id])
    assert.equal(bad.rows[0].valid,false)
    for(let i=0;i<2;i++){
      const good=await pg.query<{valid:boolean}>('select public.record_verified_puzzle($1,$2::jsonb) as valid',[puzzle.id,JSON.stringify(puzzle.answers[0])])
      assert.equal(good.rows[0].valid,true)
    }
    await pg.exec('reset role; set role anon')
    const standings=(await pg.query('select display_name, solved::integer from public.academy_leaderboard()')).rows
    assert.deepEqual(standings,[{display_name:'Public nickname',solved:1}])
    await assert.rejects(pg.query('select * from public.academy_state'),/permission denied/)
  }finally{await pg.close()}
})
