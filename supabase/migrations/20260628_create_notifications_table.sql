-- Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Admin service role has full access (handled by bypass rls)
-- Insert sample data for existing users
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id FROM public.users LIMIT 10
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, is_read)
        VALUES 
            (u.id, 'Welcome to the platform!', 'Complete your profile to get started.', 'system_alert', false),
            (u.id, 'New Feature Available', 'Check out the new notifications center!', 'system_alert', true);
    END LOOP;
END $$;
