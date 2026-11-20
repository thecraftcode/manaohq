-- ============================================================================
-- FIX: Drop the trigger on 'posts' table that inserts into 'in_app_notifications'
-- This trigger duplicates the notification logic already handled by the app's
-- /api/send-notification API route, and fails when recipient_id is NULL.
-- ============================================================================

-- 1. List all triggers on the posts table (run this first to see what's there)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'posts'
AND event_object_schema = 'public';

-- 2. Once you identify the trigger name (e.g., 'notify_on_post_update'),
--    drop it by replacing <TRIGGER_NAME> below:
-- DROP TRIGGER IF EXISTS <TRIGGER_NAME> ON public.posts;

-- 3. If you want to keep the trigger but make it not fail on NULL recipient_id,
--    you can alter the in_app_notifications table:
-- ALTER TABLE public.in_app_notifications ALTER COLUMN recipient_id DROP NOT NULL;
