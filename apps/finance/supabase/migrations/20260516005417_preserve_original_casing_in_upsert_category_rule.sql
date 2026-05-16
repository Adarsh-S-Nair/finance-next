-- Earlier today (20260515234829) the upsert RPC was made
-- case-insensitive by canonicalising conditions on BOTH the lookup
-- and the storage path. The lookup change was needed (runtime
-- matcher is case-insensitive, so duplicates that differ only in case
-- should collapse). Storing the canonical form was overreach: it
-- destroys whatever casing the user typed and renders rules as
-- lowercase in Settings.
--
-- Fix: keep the lookup canonicalised on both sides, but store the
-- input as-is. Two rules that fire on the same transactions still
-- collapse onto the same row (the lookup finds the existing row),
-- and the row in Settings reads the way the user wrote it.
--
-- Existing rules that were already rewritten by the previous
-- backfill stay lowercased — the original casing is gone from the
-- DB and there's no way to recover it. Acceptable one-time
-- regression; rules created from here on preserve casing.

create or replace function public.upsert_category_rule(
  p_user_id uuid,
  p_category_id uuid,
  p_conditions jsonb
) returns void as $$
declare
  v_rule_id uuid;
  v_canonical jsonb;
begin
  v_canonical := coalesce(public.canonicalize_rule_conditions(p_conditions), '[]'::jsonb);

  -- Canonicalise BOTH sides at lookup time so the alias-and-case
  -- collapse happens without touching the stored form. The runtime
  -- matcher already normalises on read, so there's no behavioural
  -- need to canonicalise on write — only the comparison needs it.
  select id into v_rule_id
  from public.category_rules
  where user_id = p_user_id
  and public.canonicalize_rule_conditions(conditions) = v_canonical
  limit 1;

  if v_rule_id is not null then
    update public.category_rules
    set category_id = p_category_id,
        updated_at = now()
    where id = v_rule_id;
  else
    -- Store the user's original input — preserves casing in Settings.
    insert into public.category_rules (user_id, category_id, conditions)
    values (p_user_id, p_category_id, p_conditions);
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.upsert_category_rule to authenticated;
