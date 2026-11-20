UPDATE posts
SET completed_at = post_date::timestamp with time zone
WHERE status IN ('Approved', 'Scheduled', 'Published', 'Shared') 
AND completed_at IS NULL
AND post_date IS NOT NULL;
