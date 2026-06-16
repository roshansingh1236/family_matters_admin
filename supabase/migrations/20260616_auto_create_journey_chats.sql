-- Migration to automatically create chats on journey creation
CREATE OR REPLACE FUNCTION public.create_journey_welcome_chats()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
    ip_id UUID;
    gc_id UUID;
    
    ip_name TEXT;
    gc_name TEXT;
    admin_name TEXT;

    c_admin_ip UUID;
    c_admin_gc UUID;
    c_ip_gc UUID;
    c_group UUID;

    group_name TEXT;
BEGIN
    -- Only proceed if there is an IP and GC
    ip_id := NEW.parent_id;
    gc_id := NEW.surrogate_id;

    IF ip_id IS NULL OR gc_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find Admin ID
    SELECT id INTO admin_id FROM public.users WHERE role = 'Admin' LIMIT 1;
    IF admin_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get Names
    SELECT COALESCE(full_name, first_name || ' ' || last_name) INTO ip_name FROM public.users WHERE id = ip_id;
    SELECT COALESCE(full_name, first_name || ' ' || last_name) INTO gc_name FROM public.users WHERE id = gc_id;
    SELECT COALESCE(full_name, 'Care Team Admin') INTO admin_name FROM public.users WHERE id = admin_id;

    group_name := 'Care Team — ' || COALESCE(ip_name, 'Parent') || ' & ' || COALESCE(gc_name, 'Surrogate');

    -- Function to create a conversation if it doesn't exist
    -- Note: In plpgsql we just inline it for simplicity or use a CTE

    -- 1. IP <-> Admin
    SELECT id INTO c_admin_ip FROM public.conversations WHERE participants @> ARRAY[ip_id, admin_id]::uuid[] AND array_length(participants, 1) = 2 LIMIT 1;
    IF c_admin_ip IS NULL THEN
        INSERT INTO public.conversations (participants, participant_names, last_message, last_message_time)
        VALUES (ARRAY[ip_id, admin_id]::uuid[], jsonb_build_object(ip_id::text, ip_name, admin_id::text, admin_name), 'Welcome to your journey!', NOW())
        RETURNING id INTO c_admin_ip;

        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        VALUES (c_admin_ip, ip_id, 'user'), (c_admin_ip, admin_id, 'admin');

        INSERT INTO public.messages (conversation_id, sender_id, sender_name, content, text, timestamp)
        VALUES (c_admin_ip, admin_id, admin_name, 'Welcome! I am your care team admin. Please let me know if you have any questions.', 'Welcome! I am your care team admin. Please let me know if you have any questions.', NOW());
    END IF;

    -- 2. GC <-> Admin
    SELECT id INTO c_admin_gc FROM public.conversations WHERE participants @> ARRAY[gc_id, admin_id]::uuid[] AND array_length(participants, 1) = 2 LIMIT 1;
    IF c_admin_gc IS NULL THEN
        INSERT INTO public.conversations (participants, participant_names, last_message, last_message_time)
        VALUES (ARRAY[gc_id, admin_id]::uuid[], jsonb_build_object(gc_id::text, gc_name, admin_id::text, admin_name), 'Welcome to your journey!', NOW())
        RETURNING id INTO c_admin_gc;

        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        VALUES (c_admin_gc, gc_id, 'user'), (c_admin_gc, admin_id, 'admin');

        INSERT INTO public.messages (conversation_id, sender_id, sender_name, content, text, timestamp)
        VALUES (c_admin_gc, admin_id, admin_name, 'Welcome! I am your care team admin. I am here to support you throughout your surrogacy journey.', 'Welcome! I am your care team admin. I am here to support you throughout your surrogacy journey.', NOW());
    END IF;

    -- 3. IP <-> GC
    SELECT id INTO c_ip_gc FROM public.conversations WHERE participants @> ARRAY[ip_id, gc_id]::uuid[] AND array_length(participants, 1) = 2 LIMIT 1;
    IF c_ip_gc IS NULL THEN
        INSERT INTO public.conversations (participants, participant_names, last_message, last_message_time)
        VALUES (ARRAY[ip_id, gc_id]::uuid[], jsonb_build_object(ip_id::text, ip_name, gc_id::text, gc_name), 'Your private chat is ready.', NOW())
        RETURNING id INTO c_ip_gc;

        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        VALUES (c_ip_gc, ip_id, 'user'), (c_ip_gc, gc_id, 'user');

        INSERT INTO public.messages (conversation_id, sender_id, sender_name, content, text, timestamp)
        VALUES (c_ip_gc, admin_id, admin_name, 'This is your private chat thread! You can message each other directly here.', 'This is your private chat thread! You can message each other directly here.', NOW());
    END IF;

    -- 4. Group (IP + GC + Admin)
    SELECT id INTO c_group FROM public.conversations WHERE participants @> ARRAY[ip_id, gc_id, admin_id]::uuid[] AND array_length(participants, 1) = 3 LIMIT 1;
    IF c_group IS NULL THEN
        INSERT INTO public.conversations (name, participants, participant_names, last_message, last_message_time)
        VALUES (group_name, ARRAY[ip_id, gc_id, admin_id]::uuid[], jsonb_build_object(ip_id::text, ip_name, gc_id::text, gc_name, admin_id::text, admin_name), 'Welcome to your care team chat!', NOW())
        RETURNING id INTO c_group;

        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        VALUES (c_group, ip_id, 'user'), (c_group, gc_id, 'user'), (c_group, admin_id, 'admin');

        INSERT INTO public.messages (conversation_id, sender_id, sender_name, content, text, timestamp)
        VALUES (c_group, admin_id, admin_name, 'Congratulations on your official match! This is your dedicated Care Team group chat. We are so excited to begin this journey together!', 'Congratulations on your official match! This is your dedicated Care Team group chat. We are so excited to begin this journey together!', NOW());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_create_journey_chats ON public.journeys;
CREATE TRIGGER tr_auto_create_journey_chats
AFTER INSERT ON public.journeys
FOR EACH ROW
EXECUTE FUNCTION public.create_journey_welcome_chats();

