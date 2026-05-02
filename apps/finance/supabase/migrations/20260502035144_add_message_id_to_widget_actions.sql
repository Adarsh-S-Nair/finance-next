-- Wire user_agent_widget_actions to the message that introduced the
-- tool_use. Without this FK, deleting a conversation leaves orphaned
-- action rows (the tool_use_id key has nothing to cascade through).
-- With message_id pointing at user_agent_messages, conversation delete
-- → messages cascade → widget_actions cascade. Clean.
--
-- We add the column nullable, backfill from the existing tool_use_ids
-- by jsonb-querying the corresponding assistant messages, then add the
-- FK. tool_use_ids that can't be matched (shouldn't happen but
-- defensive) stay NULL and we don't enforce a NOT NULL constraint on
-- them.

alter table public.user_agent_widget_actions
  add column if not exists message_id uuid;

-- Backfill: find the assistant message whose content blocks contain
-- this tool_use_id, scoped to the row's owner. Uses jsonb_array_elements
-- to expand the blocks array and match on the tool_use's id field.
update public.user_agent_widget_actions wa
set message_id = (
  select m.id
  from public.user_agent_messages m
  join public.user_agent_conversations c on c.id = m.conversation_id
  where c.user_id = wa.user_id
    and m.role = 'assistant'
    and exists (
      select 1
      from jsonb_array_elements(m.content->'blocks') as block
      where block->>'id' = wa.tool_use_id
        and block->>'type' = 'tool_use'
    )
  limit 1
)
where wa.message_id is null;

-- Add the FK with cascade on message delete.
alter table public.user_agent_widget_actions
  drop constraint if exists user_agent_widget_actions_message_id_fkey;
alter table public.user_agent_widget_actions
  add constraint user_agent_widget_actions_message_id_fkey
  foreign key (message_id) references public.user_agent_messages(id)
  on delete cascade;

-- We don't make it NOT NULL because backfill might leave some NULL
-- for action rows whose message got deleted before this migration ran.
-- New inserts should always set message_id; we'll enforce that at the
-- API level rather than via NOT NULL to avoid blocking legacy rows.
create index if not exists idx_user_agent_widget_actions_message
  on public.user_agent_widget_actions (message_id);
