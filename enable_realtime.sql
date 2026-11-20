-- Enable Realtime for posts, workspace_members, and team_members tables
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;

-- Enable REPLICA IDENTITY FULL so DELETE events include the old row data
-- This is required for auto-unassigning PIC when a member is removed
ALTER TABLE workspace_members REPLICA IDENTITY FULL;
ALTER TABLE team_members REPLICA IDENTITY FULL;
ALTER TABLE posts REPLICA IDENTITY FULL;

-- Verify: Check which tables are in the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
