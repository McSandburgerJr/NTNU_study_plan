-- Kjør dette én gang i Supabase: SQL Editor → New query → lim inn → Run.

-- Én rad per bruker med hele planen som JSON.
create table if not exists public.plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Radnivå-sikkerhet: hver bruker kan bare se og endre sin egen plan.
alter table public.plans enable row level security;

drop policy if exists "Les egen plan"    on public.plans;
drop policy if exists "Lag egen plan"    on public.plans;
drop policy if exists "Endre egen plan"  on public.plans;
drop policy if exists "Slett egen plan"  on public.plans;

create policy "Les egen plan"   on public.plans for select using (auth.uid() = user_id);
create policy "Lag egen plan"   on public.plans for insert with check (auth.uid() = user_id);
create policy "Endre egen plan" on public.plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Slett egen plan" on public.plans for delete using (auth.uid() = user_id);

-- Sanntid: endringer på én enhet vises med en gang på de andre.
alter publication supabase_realtime add table public.plans;
