-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Extensions to Auth.Users)
create table public.users (
  id uuid references auth.users not null primary key,
  email text unique,
  first_name text,
  last_name text,
  role text check (role in ('Intended Parent', 'Surrogate', 'Agency Staff', 'Admin')),
  status text,
  profile_image_url text,
  preferences jsonb default '{}'::jsonb,
  eligibility_status boolean default false,
  medical_clearance_status text, -- 'Cleared', 'Rejected', or null
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Matches Table
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  intended_parent_id uuid references public.users(id) not null,
  gestational_carrier_id uuid references public.users(id),
  status text not null check (status in ('Proposed', 'Presented', 'Accepted', 'Active', 'Dissolved', 'Declined')),
  match_score numeric,
  match_criteria jsonb default '{}'::jsonb,
  agency_notes text,
  matched_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 3. Journeys Table
create table public.journeys (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) not null,
  case_number text unique not null,
  status text not null,
  estimated_delivery_date date,
  journey_notes jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- 4. Agency Financials Table
create table public.agency_financials (
  id uuid default uuid_generate_v4() primary key,
  journey_id uuid references public.journeys(id),
  amount numeric not null,
  type text not null check (type in ('Revenue', 'Expense')),
  category text not null,
  description text,
  status text default 'Pending' check (status in ('Pending', 'Completed', 'Cancelled')),
  date timestamp with time zone default now(),
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now()
);

-- 5. Medical Screening Table
create table public.medical_screening (
  id uuid default uuid_generate_v4() primary key,
  surrogate_id uuid references public.users(id) not null,
  status text default 'Pending' check (status in ('Pending', 'In Review', 'Cleared', 'Rejected')),
  medical_history jsonb not null,
  internal_notes text,
  submitted_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid references public.users(id)
);

-- 6. Medical Records Table
create table public.medical_records (
  id uuid default uuid_generate_v4() primary key,
  surrogate_id uuid references public.users(id), -- Option 1: linked to surrogate specifically
  user_id uuid references public.users(id),      -- Option 2: generic user link
  patient_name text not null,
  date date not null,
  type text not null,
  title text not null,
  summary text,
  provider text,
  doctor text,
  facility text,
  status text check (status in ('Verified', 'Pending', 'Flagged')),
  shared_with_parents boolean default false,
  attachments text[], -- Array of storage URLs
  created_at timestamp with time zone default now()
);

-- 7. Medications Table
create table public.medications (
  id uuid default uuid_generate_v4() primary key,
  surrogate_id uuid references public.users(id),
  user_id uuid references public.users(id),
  name text not null,
  dosage text,
  frequency text,
  start_date date not null,
  end_date date,
  status text check (status in ('Active', 'Completed', 'Discontinued')),
  notes text,
  created_at timestamp with time zone default now()
);

-- 8. Documents Table (Shared storage metadata)
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id),
  journey_id uuid references public.journeys(id),
  screening_id uuid references public.medical_screening(id),
  name text not null,
  url text not null,
  type text,
  status text default 'pending',
  uploaded_at timestamp with time zone default now()
);

-- 9. Appointments Table
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  journey_id uuid references public.journeys(id),
  user_id uuid references public.users(id),
  title text not null,
  description text,
  date timestamp with time zone not null,
  location text,
  type text, -- 'medical', 'legal', etc.
  status text default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled')),
  created_at timestamp with time zone default now()
);

-- 10. Baby Watch Table (Medical updates)
create table public.baby_watch_updates (
  id uuid default uuid_generate_v4() primary key,
  journey_id uuid references public.journeys(id) not null,
  title text not null,
  description text,
  update_type text check (update_type in ('Ultrasound', 'Growth', 'Milestone', 'Other')),
  data jsonb default '{}'::jsonb, -- Store weight, measurements etc.
  attachments text[],
  author_id uuid references public.users(id),
  created_at timestamp with time zone default now()
);

-- 11. Messaging Module
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  journey_id uuid references public.journeys(id),
  title text, -- Null if 1:1 chat
  last_message text,
  last_message_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text, -- 'admin', 'parent', 'surrogate'
  joined_at timestamp with time zone default now(),
  unread_count int default 0,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.users(id) not null,
  content text not null,
  attachments text[],
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- 12. Tasks Table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id), -- Assigned to
  journey_id uuid references public.journeys(id),
  title text not null,
  description text,
  due_date date,
  priority text check (priority in ('Low', 'Medium', 'High')),
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now()
);

-- 13. Payments Table (Case-specific / Escrow)
create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  journey_id uuid references public.journeys(id),
  surrogate_id uuid references public.users(id),
  parent_id uuid references public.users(id),
  amount decimal(12,2) not null,
  type text check (type in ('Base Compensation', 'Allowance', 'Medical', 'Travel', 'Clothing', 'Legal', 'Other')),
  category text check (category in ('Withdrawn', 'Received')),
  status text check (status in ('Paid', 'Pending', 'Scheduled', 'Overdue', 'Cancelled', 'Rejected')),
  due_date date not null,
  paid_date date,
  description text,
  reference_number text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.journeys enable row level security;
alter table public.agency_financials enable row level security;
alter table public.medical_screening enable row level security;
alter table public.documents enable row level security;
alter table public.medical_records enable row level security;
alter table public.medications enable row level security;
alter table public.appointments enable row level security;
alter table public.baby_watch_updates enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.payments enable row level security;

-- BASIC RLS POLICIES (Templates)

-- Users can see their own profile
create policy "Individuals can view their own user data" 
on public.users for select 
using (auth.uid() = id);

-- Admins can do everything
create policy "Admins have full access" 
on public.users for all 
using (
  exists (select 1 from public.users where id = auth.uid() and role = 'Admin')
);

-- Financials are ADMIN ONLY
create policy "Financials are Admin only" 
on public.agency_financials for all 
using (
  exists (select 1 from public.users where id = auth.uid() and role = 'Admin')
);

-- Medical Screening is ADMIN ONLY
create policy "Medical Screening is Admin only" 
on public.medical_screening for all 
using (
  exists (select 1 from public.users where id = auth.uid() and role = 'Admin')
);
