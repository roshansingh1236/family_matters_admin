-- Allow authenticated users to insert notifications (Admins creating matches, IPs accepting matches)
CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
