-- Run in the SQL editor after you have registered a coach account.
-- Replace the UUID with the coach's id from Authentication > Users.
do $$
declare
  coach_id uuid := '00000000-0000-0000-0000-000000000000';
  class_id uuid;
begin
  if not exists(select 1 from public.academy_state where user_id=coach_id and role in ('coach','admin')) then
    raise exception 'Set coach_id to an existing coach or administrator';
  end if;
  insert into public.academy_classes(teacher_id,name,description)
  values(coach_id,'After-school chess club','Introductory lesson and opening practice')
  returning id into class_id;

  insert into public.academy_assignments(class_id,title,target,instructions,due_date)
  values
  (class_id,'Start with the board','/learn/introduction-to-chess','Watch the demonstration and complete guided practice.',current_date+7),
  (class_id,'Explore the Ruy Lopez','/openings/ruy-lopez/closed-variation','Complete a guided trainer session as White.',current_date+14);
end; $$;
