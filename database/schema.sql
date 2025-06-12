create table public.messages (
  id uuid not null default extensions.uuid_generate_v4 (),
  room_id uuid not null,
  sender_id uuid not null,
  content text not null,
  created_at timestamp with time zone null default now(),
  encrypted_content text null,
  constraint messages_pkey primary key (id),
  constraint messages_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_messages_room_id on public.messages using btree (room_id) TABLESPACE pg_default;

create index IF not exists idx_messages_created_at on public.messages using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_messages_room_id_created on public.messages using btree (room_id, created_at) TABLESPACE pg_default;

create index IF not exists idx_messages_room_created on public.messages using btree (room_id, created_at) TABLESPACE pg_default;






POLICIES ----- 
alter policy "Users can send messages to their rooms"


on "public"."messages"


to public


with check (
  ((sender_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM rooms
  WHERE ((rooms.id = messages.room_id) AND ((rooms.user1_id = auth.uid()) OR (rooms.user2_id = auth.uid())) AND (rooms.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM room_participants
  WHERE ((room_participants.room_id = messages.room_id) AND (room_participants.user_id = auth.uid()) AND (room_participants.is_active = true))))))

);



alter policy "Users can view messages in their rooms"


on "public"."messages"


to public


using (
    ((EXISTS ( SELECT 1
   FROM rooms
  WHERE ((rooms.id = messages.room_id) AND ((rooms.user1_id = auth.uid()) OR (rooms.user2_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM room_participants
  WHERE ((room_participants.room_id = messages.room_id) AND (room_participants.user_id = auth.uid()) AND (room_participants.is_active = true)))))
);







create table public.room_participants (
  id uuid not null default gen_random_uuid (),
  room_id uuid null,
  user_id uuid null,
  joined_at timestamp with time zone null default now(),
  last_activity timestamp with time zone null default now(),
  is_active boolean null default true,
  constraint room_participants_pkey primary key (id),
  constraint room_participants_room_id_user_id_key unique (room_id, user_id),
  constraint room_participants_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE,
  constraint room_participants_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_room_participants_room_id on public.room_participants using btree (room_id) TABLESPACE pg_default;

create index IF not exists idx_room_participants_user_id on public.room_participants using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_room_participants_activity on public.room_participants using btree (last_activity) TABLESPACE pg_default;

create index IF not exists idx_room_participants_user_room on public.room_participants using btree (user_id, room_id, is_active) TABLESPACE pg_default;


alter policy "Users can delete their own participation records"


on "public"."room_participants"


to public


using (


  (user_id = auth.uid())

);



alter policy "Users can insert their own participation records"


on "public"."room_participants"


to public


with check (


  (user_id = auth.uid())

);



alter policy "Users can update their own participation records"


on "public"."room_participants"


to public


using (


  (user_id = auth.uid())
with check (

  (user_id = auth.uid())
);
);


alter policy "Users can view their own participation records"


on "public"."room_participants"


to public


using (

  (user_id = auth.uid())

);





create table public.rooms (
  id uuid not null default extensions.uuid_generate_v4 (),
  mood public.mood_type not null,
  user1_id uuid null,
  user2_id uuid null,
  status text not null default 'waiting'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  encryption_key text null,
  ended_at timestamp with time zone null,
  end_reason text null,
  constraint rooms_pkey primary key (id),
  constraint rooms_end_reason_check check (
    (
      end_reason = any (
        array[
          'manual'::text,
          'inactivity'::text,
          'partner_left'::text
        ]
      )
    )
  ),
  constraint rooms_status_check check (
    (
      status = any (
        array['waiting'::text, 'active'::text, 'ended'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_rooms_mood_status on public.rooms using btree (mood, status) TABLESPACE pg_default;

create index IF not exists idx_rooms_created_at on public.rooms using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_rooms_status_mood on public.rooms using btree (status, mood) TABLESPACE pg_default;

create index IF not exists idx_rooms_user1 on public.rooms using btree (user1_id) TABLESPACE pg_default;

create index IF not exists idx_rooms_user2 on public.rooms using btree (user2_id) TABLESPACE pg_default;

create index IF not exists idx_rooms_status_users on public.rooms using btree (status, user1_id, user2_id) TABLESPACE pg_default;

create trigger update_rooms_updated_at BEFORE
update on rooms for EACH row
execute FUNCTION update_room_updated_at ();

create trigger trigger_cleanup_ended_room BEFORE
update on rooms for EACH row
execute FUNCTION cleanup_ended_room_messages ();





alter policy "Room creators can delete rooms"


on "public"."rooms"


to public


using (

  (user1_id = auth.uid())

);



alter policy "Users can create waiting rooms"


on "public"."rooms"


to public


with check (

7
  ((user1_id = auth.uid()) AND (user2_id IS NULL) AND (status = 'waiting'::text))

);



alter policy "Users can update their rooms"


on "public"."rooms"


to public


using (
  ((user1_id = auth.uid()) OR (user2_id = auth.uid()) OR ((status = 'waiting'::text) AND (user2_id IS NULL)))
with check (


 ((user1_id = auth.uid()) OR (user2_id = auth.uid()))
);
)



alter policy "Users can view accessible rooms"


on "public"."rooms"


to public


using (
    ((user1_id = auth.uid()) OR (user2_id = auth.uid()) OR ((status = 'waiting'::text) AND (user2_id IS NULL)) OR (EXISTS ( SELECT 1
   FROM room_participants
  WHERE ((room_participants.room_id = rooms.id) AND (room_participants.user_id = auth.uid()) AND (room_participants.is_active = true)))))
);