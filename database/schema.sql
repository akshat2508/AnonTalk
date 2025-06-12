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








AFTER ENCYPTION ----------------------
-- Add missing encryption fields to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS sender_public_key TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Create table for managing room keys (for key exchange)
CREATE TABLE IF NOT EXISTS public.room_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    participant_public_key TEXT NOT NULL,
    encrypted_room_key TEXT NOT NULL,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, participant_public_key)
) TABLESPACE pg_default;

-- Enable RLS for room_keys
ALTER TABLE public.room_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_keys
CREATE POLICY "Users can read their room keys" ON public.room_keys
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM rooms r
            WHERE r.id = room_keys.room_id
            AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
        ) OR EXISTS (
            SELECT 1 FROM room_participants rp
            WHERE rp.room_id = room_keys.room_id
            AND rp.user_id = auth.uid()
            AND rp.is_active = true
        )
    );

CREATE POLICY "Users can share room keys" ON public.room_keys
    FOR INSERT
    TO public
    WITH CHECK (
        shared_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM rooms r
                WHERE r.id = room_keys.room_id
                AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
            ) OR EXISTS (
                SELECT 1 FROM room_participants rp
                WHERE rp.room_id = room_keys.room_id
                AND rp.user_id = auth.uid()
                AND rp.is_active = true
            )
        )
    );

CREATE POLICY "Users can update their shared keys" ON public.room_keys
    FOR UPDATE
    TO public
    USING (shared_by = auth.uid())
    WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Users can delete their shared keys" ON public.room_keys
    FOR DELETE
    TO public
    USING (shared_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_keys_room_participant ON public.room_keys(room_id, participant_public_key) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_room_keys_shared_by ON public.room_keys(shared_by) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON public.messages(room_id, is_encrypted) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_sender_public_key ON public.messages(sender_public_key) TABLESPACE pg_default;

-- Function to cleanup old room keys when room ends
CREATE OR REPLACE FUNCTION cleanup_room_keys()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        DELETE FROM room_keys WHERE room_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup room keys when room ends
DROP TRIGGER IF EXISTS trigger_cleanup_room_keys ON public.rooms;
CREATE TRIGGER trigger_cleanup_room_keys
    AFTER UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_room_keys();

-- Update existing message policies to handle encrypted messages
-- First, let's create a new policy specifically for encrypted message handling
CREATE POLICY "Users can send encrypted messages to their rooms" ON public.messages
    FOR INSERT
    TO public
    WITH CHECK (
        sender_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM rooms r
                WHERE r.id = messages.room_id 
                AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid()) 
                AND r.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM room_participants rp
                WHERE rp.room_id = messages.room_id 
                AND rp.user_id = auth.uid() 
                AND rp.is_active = true
            )
        )
    );

-- Create a view for encrypted message metadata (admin purposes)
CREATE OR REPLACE VIEW public.admin_messages_view AS
SELECT 
    m.id,
    m.room_id,
    m.sender_id,
    CASE 
        WHEN m.is_encrypted THEN '[ENCRYPTED MESSAGE]'
        ELSE m.content
    END AS display_content,
    m.created_at,
    m.is_encrypted,
    CASE 
        WHEN m.is_encrypted THEN 'AES-256-GCM'
        ELSE 'NONE'
    END AS encryption_type,
    LENGTH(m.encrypted_content) as encrypted_size,
    m.sender_public_key IS NOT NULL as has_sender_key
FROM messages m;

-- Function to get room encryption status
CREATE OR REPLACE FUNCTION get_room_encryption_status(room_uuid UUID)
RETURNS TABLE (
    room_id UUID,
    has_encryption_keys BOOLEAN,
    participant_count BIGINT,
    keys_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as room_id,
        EXISTS(SELECT 1 FROM room_keys rk WHERE rk.room_id = r.id) as has_encryption_keys,
        COALESCE(participant_count.count, 0) as participant_count,
        COALESCE(keys_count.count, 0) as keys_count
    FROM rooms r
    LEFT JOIN (
        SELECT room_id, COUNT(*) as count 
        FROM room_participants 
        WHERE is_active = true 
        GROUP BY room_id
    ) participant_count ON participant_count.room_id = r.id
    LEFT JOIN (
        SELECT room_id, COUNT(*) as count 
        FROM room_keys 
        GROUP BY room_id
    ) keys_count ON keys_count.room_id = r.id
    WHERE r.id = room_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_room_encryption_status(UUID) TO public;

-- Add constraint to ensure encrypted messages have required fields
ALTER TABLE public.messages 
ADD CONSTRAINT check_encrypted_message_fields 
CHECK (
    (is_encrypted = false) OR 
    (is_encrypted = true AND encrypted_content IS NOT NULL AND iv IS NOT NULL AND sender_public_key IS NOT NULL)
);

-- Add constraint to ensure non-encrypted messages don't have encryption fields populated unnecessarily
ALTER TABLE public.messages 
ADD CONSTRAINT check_non_encrypted_message_fields 
CHECK (
    (is_encrypted = true) OR 
    (is_encrypted = false AND encrypted_content IS NULL AND iv IS NULL AND sender_public_key IS NULL)
);

-- Comments for documentation
COMMENT ON TABLE public.room_keys IS 'Stores encrypted room keys for end-to-end encryption key exchange';
COMMENT ON COLUMN public.messages.encrypted_content IS 'AES-256-GCM encrypted message content';
COMMENT ON COLUMN public.messages.iv IS 'Initialization vector for AES encryption';
COMMENT ON COLUMN public.messages.sender_public_key IS 'Public key of the message sender for key verification';
COMMENT ON COLUMN public.messages.is_encrypted IS 'Boolean flag indicating if the message is encrypted';
COMMENT ON COLUMN public.room_keys.encrypted_room_key IS 'Room symmetric key encrypted with participant public key';
COMMENT ON COLUMN public.room_keys.participant_public_key IS 'Public key of the participant who can decrypt the room key';
COMMENT ON COLUMN public.room_keys.shared_by IS 'User ID of who shared this encrypted key';

-- Create function to safely delete old encrypted messages (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_old_encrypted_messages(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE is_encrypted = true 
    AND created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on purge function (restrict to admin users in production)
GRANT EXECUTE ON FUNCTION purge_old_encrypted_messages(INTEGER) TO public;