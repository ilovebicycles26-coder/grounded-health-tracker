create table public.partnerships (
 id uuid primary key default gen_random_uuid(), user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade, status text not null default 'active' check(status in('active','ended')),
 created_at timestamptz not null default now(), ended_at timestamptz,
 check(user_a<user_b), unique(user_a,user_b)
);
create table public.partner_invites (
 id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id) on delete cascade,
 code_hash text not null unique, expires_at timestamptz not null, accepted_by uuid references auth.users(id) on delete set null,
 accepted_at timestamptz, created_at timestamptz not null default now()
);
create table public.sharing_grants (
 id uuid primary key, owner_user_id uuid not null references auth.users(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 resource_type text not null check(resource_type in('weight_progress','routine_library','habit_progress')),
 permission text not null default 'view' check(permission='view'), revoked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(owner_user_id<>recipient_user_id), unique(owner_user_id,recipient_user_id,resource_type)
);
create index partnerships_user_a_idx on public.partnerships(user_a,status); create index partnerships_user_b_idx on public.partnerships(user_b,status);
create index partner_invites_creator_idx on public.partner_invites(created_by,expires_at desc);
create index sharing_grants_recipient_idx on public.sharing_grants(recipient_user_id,resource_type) where revoked_at is null;

create function private.has_active_partnership(first_user uuid,second_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.partnerships p where p.user_a=least(first_user,second_user) and p.user_b=greatest(first_user,second_user) and p.status='active')
$$;
create function private.can_access_shared_resource(owner_id uuid,recipient_id uuid,requested_resource text) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_active_partnership(owner_id,recipient_id) and exists(select 1 from public.sharing_grants g where g.owner_user_id=owner_id and g.recipient_user_id=recipient_id and g.resource_type=requested_resource and g.revoked_at is null)
$$;
revoke all on function private.has_active_partnership(uuid,uuid), private.can_access_shared_resource(uuid,uuid,text) from public,anon,authenticated;

create function public.create_partner_invite() returns text language plpgsql volatile security definer set search_path='' as $$
declare invite_code text; begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 invite_code:=upper(encode(extensions.gen_random_bytes(5),'hex'));
 insert into public.partner_invites(created_by,code_hash,expires_at) values(auth.uid(),encode(extensions.digest(invite_code,'sha256'),'hex'),now()+interval '7 days');
 return invite_code;
end $$;
create function public.accept_partner_invite(invite_code text) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare invite public.partner_invites; partnership_id uuid; begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 select * into invite from public.partner_invites where code_hash=encode(extensions.digest(upper(trim(invite_code)),'sha256'),'hex') and accepted_at is null and expires_at>now() for update;
 if invite.id is null or invite.created_by=auth.uid() then raise exception 'invalid_invite'; end if;
 insert into public.partnerships(user_a,user_b) values(least(invite.created_by,auth.uid()),greatest(invite.created_by,auth.uid()))
 on conflict(user_a,user_b) do update set status='active',ended_at=null returning id into partnership_id;
 update public.partner_invites set accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
 return partnership_id;
end $$;
create function public.list_my_partners() returns table(partnership_id uuid,partner_user_id uuid,display_name text) language sql stable security definer set search_path='' as $$
 select p.id,case when p.user_a=auth.uid() then p.user_b else p.user_a end,coalesce(pr.display_name,'Partner')
 from public.partnerships p left join public.profiles pr on pr.user_id=case when p.user_a=auth.uid() then p.user_b else p.user_a end
 where p.status='active' and auth.uid() in(p.user_a,p.user_b)
$$;
create function public.get_shared_weight_summary(target_user uuid) returns table(current_weight_kg numeric,first_weight_kg numeric,target_weight_kg numeric,last_measured_on date) language sql stable security definer set search_path='' as $$
 select current_entry.weight_kg,first_entry.weight_kg,goal.target_weight_kg,current_entry.measured_on
 from lateral(select w.weight_kg,w.measured_on from public.weight_entries w where w.user_id=target_user and w.deleted_at is null order by w.measured_on desc,w.created_at desc limit 1) current_entry
 cross join lateral(select w.weight_kg from public.weight_entries w where w.user_id=target_user and w.deleted_at is null order by w.measured_on,w.created_at limit 1) first_entry
 left join lateral(select g.target_weight_kg from public.weight_goals g where g.user_id=target_user and g.deleted_at is null limit 1) goal on true
 where private.can_access_shared_resource(target_user,auth.uid(),'weight_progress')
$$;
revoke all on function public.create_partner_invite(), public.accept_partner_invite(text), public.list_my_partners(), public.get_shared_weight_summary(uuid) from public,anon;
grant execute on function public.create_partner_invite(), public.accept_partner_invite(text), public.list_my_partners(), public.get_shared_weight_summary(uuid) to authenticated;

alter table public.partnerships enable row level security; alter table public.partner_invites enable row level security; alter table public.sharing_grants enable row level security;
revoke all on public.partnerships,public.partner_invites,public.sharing_grants from anon,public;
grant select,update on public.partnerships to authenticated; grant select on public.partner_invites to authenticated; grant select,insert,update on public.sharing_grants to authenticated;
create policy "partnership participants select" on public.partnerships for select to authenticated using((select auth.uid()) in(user_a,user_b));
create policy "partnership participants end" on public.partnerships for update to authenticated using((select auth.uid()) in(user_a,user_b)) with check((select auth.uid()) in(user_a,user_b));
create policy "invite creator select" on public.partner_invites for select to authenticated using((select auth.uid())=created_by);
create policy "sharing participants select" on public.sharing_grants for select to authenticated using((select auth.uid()) in(owner_user_id,recipient_user_id));
create policy "sharing owner insert" on public.sharing_grants for insert to authenticated with check((select auth.uid())=owner_user_id and private.has_active_partnership(owner_user_id,recipient_user_id));
create policy "sharing owner update" on public.sharing_grants for update to authenticated using((select auth.uid())=owner_user_id) with check((select auth.uid())=owner_user_id and private.has_active_partnership(owner_user_id,recipient_user_id));

create policy "shared routines select" on public.exercise_routines for select to authenticated using(private.can_access_shared_resource(user_id,(select auth.uid()),'routine_library'));
create policy "shared habit definitions select" on public.habit_definitions for select to authenticated using(private.can_access_shared_resource(user_id,(select auth.uid()),'habit_progress'));
create policy "shared habit completions select" on public.habit_completions for select to authenticated using(private.can_access_shared_resource(user_id,(select auth.uid()),'habit_progress'));
