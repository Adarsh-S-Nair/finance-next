-- Canonicalize rule conditions in upsert_category_rule so two rules
-- that match the same transactions (modulo operator alias and string
-- case) collapse to a single row.
--
-- matchesRule (lib/category-rules.ts) already lowercases string
-- comparisons and treats `is` and `equals` as identical, so two rules
-- differing only on those axes fire on the same transactions. Storing
-- them as separate rows in the DB is just visual noise in Settings.
-- Before this migration the agent's category-rules API route
-- canonicalised in app code, but the transactions-page UI called this
-- RPC directly and skipped that step — so case-mismatched duplicates
-- could leak through whenever a user touched Apply-to-similar.
--
-- Canonicalisation rules (match the JS helper of the same name):
--   - amount field: operator `is` → `equals`
--   - string fields: operator `equals` → `is`
--   - string values: lowercase + trim
--   - amount values: passed through (matchesRule normalises to
--     magnitude at compare time)

create or replace function public.canonicalize_rule_conditions(p_conditions jsonb)
returns jsonb as $$
  select jsonb_agg(
    case
      when (cond->>'field') = 'amount' then
        jsonb_build_object(
          'field', cond->'field',
          'operator', to_jsonb(
            case when cond->>'operator' = 'is' then 'equals'
                 else cond->>'operator'
            end
          ),
          'value', cond->'value'
        )
      else
        jsonb_build_object(
          'field', cond->'field',
          'operator', to_jsonb(
            case when cond->>'operator' = 'equals' then 'is'
                 else cond->>'operator'
            end
          ),
          'value', to_jsonb(lower(trim(cond->>'value')))
        )
    end
  )
  from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) as cond;
$$ language sql immutable;

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

  -- Existing-row check uses the canonical form so the agent and UI
  -- paths collapse onto the same row even if they pass slightly
  -- different operator aliases / casing.
  select id into v_rule_id
  from public.category_rules
  where user_id = p_user_id
  and conditions = v_canonical
  limit 1;

  if v_rule_id is not null then
    update public.category_rules
    set category_id = p_category_id,
        updated_at = now()
    where id = v_rule_id;
  else
    insert into public.category_rules (user_id, category_id, conditions)
    values (p_user_id, p_category_id, v_canonical);
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.upsert_category_rule to authenticated;

-- Backfill: rewrite every existing rule's conditions into canonical
-- form so future upsert lookups can find them. Behaviour-preserving
-- (matchesRule already normalised on compare); this just collapses the
-- stored representation.
update public.category_rules
set conditions = public.canonicalize_rule_conditions(conditions)
where conditions is not null
  and conditions <> public.canonicalize_rule_conditions(conditions);

-- Dedupe: when two rules end up with the same canonical conditions
-- for one user, keep the newest (matches the "newer wins" matcher
-- priority and the "upsert overrides" expectation the user reported).
delete from public.category_rules
where id in (
  select id from (
    select id,
           row_number() over (
             partition by user_id, conditions
             order by created_at desc, id desc
           ) as rn
    from public.category_rules
  ) ranked
  where rn > 1
);
