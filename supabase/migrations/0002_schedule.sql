-- Optional: delete messages of closed chats every hour.
-- First enable the pg_cron extension (Supabase dashboard → Database → Extensions → pg_cron).

create extension if not exists pg_cron;

select cron.schedule('cleanup-expired-chats', '0 * * * *', $$select public.cleanup_expired()$$);
