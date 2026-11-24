-- Example: add a venue and make someone its admin.
-- The admin must have signed in to the app once so their user exists.

insert into public.venues (slug, name, visibility_hours, message_cap, chat_hours)
values ('my-cafe', 'My Café', 24, 10, 24);

insert into public.venue_admins (venue_id, user_id)
select v.id, u.id
from public.venues v, auth.users u
where v.slug = 'my-cafe' and u.email = 'owner@example.com';
