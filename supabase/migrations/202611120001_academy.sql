-- Run as the migration owner. API access is granted explicitly.
create table public.academy_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}',
  events jsonb not null default '[]',
  repertoire jsonb not null default '[]',
  role text not null default 'student' check (role in ('student','coach','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.academy_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  requests integer not null,
  primary key (user_id, action)
);
create table public.academy_puzzle_keys (
  id text primary key,
  answers jsonb not null check (jsonb_typeof(answers)='array')
);
create table public.academy_verified_puzzles (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.academy_puzzle_keys(id) on delete cascade,
  solved_at timestamptz not null default now(),
  primary key (user_id,puzzle_id)
);
create table public.academy_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description)<=400),
  invitation_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,12),
  created_at timestamptz not null default now()
);
create table public.academy_members (
  class_id uuid not null references public.academy_classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id,student_id)
);
create table public.academy_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.academy_classes(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  target text not null check (target ~ '^/(learn|puzzles|openings|quizzes|endgames)/[a-zA-Z0-9/-]{1,150}$'),
  instructions text not null default '' check (length(instructions)<=1000),
  due_date date,
  created_at timestamptz not null default now()
);
create table public.academy_catalog (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  kind text not null check (kind in ('opening','puzzle','lesson','endgame')),
  fen text not null,
  moves jsonb not null,
  notes jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index academy_classes_teacher on public.academy_classes(teacher_id);
create index academy_members_student on public.academy_members(student_id,class_id);
create index academy_assignments_class on public.academy_assignments(class_id, due_date);
create index academy_catalog_published on public.academy_catalog(published,created_at);
alter table public.academy_state enable row level security;
alter table public.academy_limits enable row level security;
alter table public.academy_puzzle_keys enable row level security;
alter table public.academy_verified_puzzles enable row level security;
alter table public.academy_classes enable row level security;
alter table public.academy_members enable row level security;
alter table public.academy_assignments enable row level security;
alter table public.academy_catalog enable row level security;
revoke all on public.academy_state, public.academy_limits, public.academy_puzzle_keys, public.academy_verified_puzzles, public.academy_classes, public.academy_members, public.academy_assignments, public.academy_catalog from anon, authenticated;
grant select on public.academy_state to authenticated;
grant select (id,teacher_id,name,description,created_at), insert (name,description) on public.academy_classes to authenticated;
grant select on public.academy_members to authenticated;
grant select, insert, delete on public.academy_assignments to authenticated;
grant select on public.academy_catalog to anon, authenticated;
grant all on public.academy_catalog to service_role;

create function public.academy_role() returns text language sql stable security definer set search_path = ''
as $$ select coalesce((select role from public.academy_state where user_id=auth.uid()),'student'); $$;
create function public.academy_owns_class(class_key uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select public.academy_role() in ('coach','admin') and exists(select 1 from public.academy_classes where id=class_key and teacher_id=auth.uid()); $$;
create function public.academy_in_class(class_key uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.academy_members where class_id=class_key and student_id=auth.uid()); $$;
create policy read_own_progress on public.academy_state for select to authenticated using (user_id=auth.uid());
create policy read_classes on public.academy_classes for select to authenticated using ((teacher_id=auth.uid() and public.academy_role() in ('coach','admin')) or public.academy_in_class(id));
create policy create_class on public.academy_classes for insert to authenticated with check (teacher_id=auth.uid() and public.academy_role() in ('coach','admin'));
create policy read_members on public.academy_members for select to authenticated using (student_id=auth.uid() or public.academy_owns_class(class_id));
create policy read_assignments on public.academy_assignments for select to authenticated using (public.academy_owns_class(class_id) or public.academy_in_class(class_id));
create policy add_assignment on public.academy_assignments for insert to authenticated with check (public.academy_owns_class(class_id));
create policy delete_assignment on public.academy_assignments for delete to authenticated using (public.academy_owns_class(class_id));
create policy read_catalog on public.academy_catalog for select to anon,authenticated using (published);
create policy read_drafts on public.academy_catalog for select to authenticated using (public.academy_role()='admin');

create function public.create_academy_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.academy_state(user_id,profile) values(new.id,jsonb_build_object(
    'name', left(coalesce(new.raw_user_meta_data->>'display_name',''),60),
    'level', case when new.raw_user_meta_data->>'level' in ('Intermediate','Advanced') then new.raw_user_meta_data->>'level' else 'Beginner' end))
    on conflict do nothing;
  return new;
end; $$;
create trigger academy_profile_after_signup after insert on auth.users for each row execute function public.create_academy_profile();
insert into public.academy_state(user_id) select id from auth.users on conflict do nothing;

create function public.academy_rate(limit_action text, per_minute integer) returns void language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.academy_limits as l(user_id,action,window_start,requests) values(auth.uid(),limit_action,now(),1)
  on conflict(user_id,action) do update set
    requests=case when now()-l.window_start>interval '1 minute' then 1 else l.requests+1 end,
    window_start=case when now()-l.window_start>interval '1 minute' then now() else l.window_start end
  returning requests into used;
  if used>per_minute then raise exception 'Please wait a minute before trying again'; end if;
end; $$;

create function public.save_academy_state(new_profile jsonb, new_events jsonb, new_repertoire jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare old_events jsonb; old_repertoire jsonb; merged_events jsonb; merged_repertoire jsonb;
begin
  perform public.academy_rate('sync',60);
  if jsonb_typeof(new_profile) is distinct from 'object' or jsonb_typeof(new_events) is distinct from 'array' or jsonb_typeof(new_repertoire) is distinct from 'array'
     or octet_length(new_profile::text)>115000 or octet_length(new_events::text)>1000000 or octet_length(new_repertoire::text)>500000
     or jsonb_array_length(new_events)>5000 or jsonb_array_length(new_repertoire)>500 then raise exception 'Progress payload exceeds the supported limit'; end if;
  select events,repertoire into old_events,old_repertoire from public.academy_state where user_id=auth.uid() for update;
  select coalesce(jsonb_agg(data),'[]'::jsonb) into merged_events from (
    select distinct on (event->>'key') event || jsonb_build_object('xp', case event->>'kind' when 'lesson' then 40 when 'puzzle' then 15 when 'daily' then 25 when 'opening' then 30 when 'quiz' then 25 when 'endgame' then 35 when 'game' then 35 else 0 end) as data
    from jsonb_array_elements(coalesce(old_events,'[]')||new_events) as list(event)
    where event->>'kind' in ('lesson','puzzle','daily','opening','quiz','endgame','game','record')
      and event->>'key' like (event->>'kind')||':%'
      and length(event->>'key')<=200 and length(event->>'title')<=200
      and event->>'at' ~ '^\d{4}-\d{2}-\d{2}T'
      and jsonb_typeof(event->'score')='number' and (event->>'score')::numeric between 0 and 100000
    order by event->>'key', event->>'at' desc
  ) merged;
  select coalesce(jsonb_agg(entry),'[]'::jsonb) into merged_repertoire from (
    select distinct on (entry->>'id') entry
    from jsonb_array_elements(coalesce(old_repertoire,'[]')||new_repertoire) as list(entry)
    where length(entry->>'id') between 1 and 200 and octet_length(entry::text)<=30000
    order by entry->>'id', entry->>'updatedAt' desc nulls last
  ) merged;
  insert into public.academy_state(user_id,profile,events,repertoire) values(auth.uid(),new_profile,merged_events,merged_repertoire)
  on conflict(user_id) do update set profile=excluded.profile,events=excluded.events,repertoire=excluded.repertoire,updated_at=now();
end; $$;
create function public.record_verified_puzzle(puzzle text, proof jsonb) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.academy_rate('puzzle',90);
  if jsonb_typeof(proof) is distinct from 'array' or octet_length(proof::text)>200 then return false; end if;
  if not exists(select 1 from public.academy_puzzle_keys where id=puzzle and answers @> jsonb_build_array(proof)
    and exists (select 1 from jsonb_array_elements(answers) candidate where candidate=proof)) then return false; end if;
  insert into public.academy_verified_puzzles(user_id,puzzle_id) values(auth.uid(),puzzle) on conflict do nothing;
  return true;
end; $$;
create function public.academy_leaderboard() returns table(display_name text,solved bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(left(trim(s.profile->>'name'),60),''),'Learner'),count(*)
  from public.academy_verified_puzzles p join public.academy_state s on s.user_id=p.user_id
  where s.profile->'public'='true'::jsonb
  group by s.user_id,s.profile->>'name' order by count(*) desc,s.user_id limit 50;
$$;

create function public.join_academy_class(code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare class_key uuid;
begin
  perform public.academy_rate('join',10);
  select id into class_key from public.academy_classes where invitation_code=lower(trim(code));
  if class_key is not null then insert into public.academy_members(class_id,student_id) values(class_key,auth.uid()) on conflict do nothing; end if;
  return class_key;
end; $$;
create function public.academy_class_code(class_key uuid) returns text language sql stable security definer set search_path = '' as $$
  select invitation_code from public.academy_classes where id=class_key and public.academy_owns_class(class_key);
$$;
create function public.academy_class_report(class_key uuid) returns table(student_id uuid, display_name text, events jsonb)
language sql stable security definer set search_path = '' as $$
  select m.student_id,coalesce(nullif(left(trim(s.profile->>'name'),60),''),'Learner'),coalesce(s.events,'[]')
  from public.academy_members m left join public.academy_state s on s.user_id=m.student_id
  where m.class_id=class_key and public.academy_owns_class(class_key) order by 2;
$$;
create function public.academy_users() returns table(user_id uuid,display_name text,role text)
language sql stable security definer set search_path = '' as $$
  select s.user_id,coalesce(nullif(left(trim(s.profile->>'name'),60),''),'Learner'),s.role
  from public.academy_state s where public.academy_role()='admin' order by 2 limit 500;
$$;
create function public.set_academy_role(account uuid, new_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.academy_role()<>'admin' then raise exception 'Administrator access required'; end if;
  if account=auth.uid() then raise exception 'Ask another administrator to change your role'; end if;
  update public.academy_state set role=new_role,updated_at=now() where user_id=account;
end; $$;

revoke all on function public.create_academy_profile(),public.academy_rate(text,integer),public.academy_role(),public.academy_owns_class(uuid),public.academy_in_class(uuid),
  public.save_academy_state(jsonb,jsonb,jsonb),public.record_verified_puzzle(text,jsonb),public.academy_leaderboard(),public.join_academy_class(text),
  public.academy_class_code(uuid),public.academy_class_report(uuid),public.academy_users(),public.set_academy_role(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_role() to anon,authenticated;
grant execute on function public.academy_owns_class(uuid),public.academy_in_class(uuid),public.save_academy_state(jsonb,jsonb,jsonb),public.record_verified_puzzle(text,jsonb),
  public.join_academy_class(text),public.academy_class_code(uuid),public.academy_class_report(uuid),public.academy_users(),public.set_academy_role(uuid,text) to authenticated;
grant execute on function public.academy_leaderboard() to anon,authenticated;
create table public.academy_settings (
  singleton boolean primary key default true check(singleton),
  quiz_passing_score smallint not null default 80 check(quiz_passing_score between 50 and 100)
);
insert into public.academy_settings default values;
alter table public.academy_settings enable row level security;
revoke all on public.academy_settings from anon,authenticated;
grant select on public.academy_settings to anon,authenticated;
grant update (quiz_passing_score) on public.academy_settings to authenticated;
create policy public_academy_settings on public.academy_settings for select to anon,authenticated using (true);
create policy administer_academy_settings on public.academy_settings for update to authenticated
  using (public.academy_role()='admin') with check (public.academy_role()='admin');
