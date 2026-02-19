-- 1. Create Buckets
-- users: For user documents and profile images
insert into storage.buckets (id, name, public) 
select 'users', 'users', true 
where not exists (select 1 from storage.buckets where id = 'users');

-- baby_watch: For baby watch update images
insert into storage.buckets (id, name, public) 
select 'baby_watch', 'baby_watch', true 
where not exists (select 1 from storage.buckets where id = 'baby_watch');

-- messages: For chat attachments
insert into storage.buckets (id, name, public) 
select 'messages', 'messages', true 
where not exists (select 1 from storage.buckets where id = 'messages');

-- 2. Policies for 'users'
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Public Access for users' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Public Access for users" on storage.objects for select using (bucket_id = 'users');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Uploads for users' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Uploads for users" on storage.objects for insert with check (bucket_id = 'users');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Updates for users' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Updates for users" on storage.objects for update using (bucket_id = 'users');
    end if;
     if not exists (select 1 from pg_policies where policyname = 'Allow Deletes for users' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Deletes for users" on storage.objects for delete using (bucket_id = 'users');
    end if;
end $$;

-- 3. Policies for 'baby_watch'
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Public Access for baby_watch' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Public Access for baby_watch" on storage.objects for select using (bucket_id = 'baby_watch');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Uploads for baby_watch' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Uploads for baby_watch" on storage.objects for insert with check (bucket_id = 'baby_watch');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Deletes for baby_watch' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Deletes for baby_watch" on storage.objects for delete using (bucket_id = 'baby_watch');
    end if;
end $$;

-- 4. Policies for 'messages'
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Public Access for messages' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Public Access for messages" on storage.objects for select using (bucket_id = 'messages');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Uploads for messages' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Uploads for messages" on storage.objects for insert with check (bucket_id = 'messages');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow Deletes for messages' and tablename = 'objects' and schemaname = 'storage') then
        create policy "Allow Deletes for messages" on storage.objects for delete using (bucket_id = 'messages');
    end if;
end $$;
