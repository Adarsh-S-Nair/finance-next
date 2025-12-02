-- Function to upsert category rules based on conditions
-- This prevents duplicate rules for the same set of conditions

create or replace function public.upsert_category_rule(
  p_user_id uuid,
  p_category_id uuid,
  p_conditions jsonb
) returns void as $$
declare
  v_rule_id uuid;
begin
  -- Check for existing rule with exact same conditions for this user
  select id into v_rule_id
  from public.category_rules
  where user_id = p_user_id
  and conditions = p_conditions
  limit 1;

  if v_rule_id is not null then
    -- Update existing rule
    update public.category_rules
    set category_id = p_category_id,
        updated_at = now()
    where id = v_rule_id;
  else
    -- Insert new rule
    insert into public.category_rules (user_id, category_id, conditions)
    values (p_user_id, p_category_id, p_conditions);
  end if;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function public.upsert_category_rule to authenticated;
