-- Create user_notification_prefs table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_notification_prefs (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    assignment BOOLEAN NOT NULL DEFAULT TRUE,
    deadline_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    missed_share BOOLEAN NOT NULL DEFAULT TRUE,
    owner_report BOOLEAN NOT NULL DEFAULT TRUE,
    posting_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can read their own prefs
CREATE POLICY "Users can read own prefs"
    ON user_notification_prefs FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own prefs
CREATE POLICY "Users can insert own prefs"
    ON user_notification_prefs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own prefs
CREATE POLICY "Users can update own prefs"
    ON user_notification_prefs FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can read any prefs (for cron job)
-- Note: service_role key bypasses RLS by default, so no extra policy needed.

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_notification_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_prefs_timestamp
    BEFORE UPDATE ON user_notification_prefs
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_prefs_timestamp();
