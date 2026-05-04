-- Notifications Table
create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    farmer_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    message text not null,
    type text not null default 'info', /* e.g., info, reminder, warning, ticket */
    is_read boolean default false not null,
    action_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
    on public.notifications for select
    using ( auth.uid() = farmer_id );

create policy "Users can mark their own notifications as read"
    on public.notifications for update
    using ( auth.uid() = farmer_id );

create policy "Service role can create notifications"
    on public.notifications for insert
    with check ( true ); 
