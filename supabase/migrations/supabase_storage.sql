-- SUPABASE STORAGE BUCKETS AND POLICIES (IDEMPOTENT)
-- Project: Surrogacy App

-- 1. CREATE BUCKETS
-- Using ON CONFLICT (if supported by your version) or simply a check
-- Actually, inserting into storage.buckets can be tricky with ON CONFLICT.
-- We'll use a standard insert and handle the error or use a safe check.

insert into storage.buckets (id, name, public) 
select 'profiles', 'profiles', true 
where not exists (select 1 from storage.buckets where id = 'profiles');

insert into storage.buckets (id, name, public) 
select 'documents', 'documents', false 
where not exists (select 1 from storage.buckets where id = 'documents');

insert into storage.buckets (id, name, public) 
select 'medical', 'medical', false 
where not exists (select 1 from storage.buckets where id = 'medical');

insert into storage.buckets (id, name, public) 
select 'ultrasound', 'ultrasound', false 
where not exists (select 1 from storage.buckets where id = 'ultrasound');

-- 2. POLICIES FOR 'profiles' BUCKET
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Profile images are public' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Profile images are public" on storage.objects for select using (bucket_id = 'profiles');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can upload their own profile image' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Users can upload their own profile image" on storage.objects for insert with check (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);
    end if;
     if not exists (select 1 from pg_policies where policyname = 'Users can update their own profile image' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Users can update their own profile image" on storage.objects for update using (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);
    end if;
end $$;

-- 3. POLICIES FOR 'documents' BUCKET
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Users can access their own documents' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Users can access their own documents" on storage.objects for select using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can upload their own documents' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Users can upload their own documents" on storage.objects for insert with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
    end if;
end $$;

-- 4. POLICIES FOR 'medical' BUCKET
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Users can access their own medical files' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Users can access their own medical files" on storage.objects for select using (bucket_id = 'medical' and auth.uid()::text = (storage.foldername(name))[1]);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Agency staff can access all medical files' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Agency staff can access all medical files" on storage.objects for select using (bucket_id = 'medical' and exists (select 1 from public.users where id = auth.uid() and role = 'agencyStaff'));
    end if;
end $$;

-- 5. POLICIES FOR 'ultrasound' BUCKET
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Surrogates can upload ultrasound images' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Surrogates can upload ultrasound images" on storage.objects for insert with check (bucket_id = 'ultrasound' and exists (select 1 from public.users where id = auth.uid() and role = 'gestationalCarrier'));
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Matched IP and Surrogate can view ultrasound images' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Matched IP and Surrogate can view ultrasound images" on storage.objects for select using (bucket_id = 'ultrasound' and (
            auth.uid()::text = (storage.foldername(name))[1] or 
            exists (
                select 1 from public.matches m 
                where (m.intended_parent_id = auth.uid() or m.gestational_carrier_id = auth.uid())
                and (m.intended_parent_id::text = (storage.foldername(name))[1] or m.gestational_carrier_id::text = (storage.foldername(name))[1])
            )
        ));
    end if;
end $$;
