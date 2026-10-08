-- Add last_message_preview to email_threads (like chat_conversations)
alter table public.email_threads
  add column if not exists last_message_preview text;
