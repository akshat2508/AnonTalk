-- Complete Supabase Database Schema Recreation Script
-- Run this script in your new Supabase project's SQL Editor

-- =====================================================
-- 1. CREATE CUSTOM TYPES
-- =====================================================

-- Create mood_type enum
CREATE TYPE public.mood_type AS ENUM (
    'happy',
    'sad',
    'excited',
    'calm',
    'anxious',
    'lonely',
    'angry',
    'confused',
    'grateful',
    'stressed'
);

-- =====================================================
-- 2. CREATE TABLES
-- =====================================================

-- Create rooms table
CREATE TABLE public.rooms (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    mood public.mood_type NOT NULL,
    user1_id uuid NULL,
    user2_id uuid NULL,
    status text NOT NULL DEFAULT 'waiting'::text,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    encryption_key text NULL,
    ended_at timestamp with time zone NULL,
    end_reason text NULL,
    CONSTRAINT rooms_pkey PRIMARY KEY (id),
    CONSTRAINT rooms_end_reason_check CHECK (
        end_reason = ANY (
            ARRAY[
                'manual'::text,
                'inactivity'::text,
                'partner_left'::text,
                'cleanup'::text
            ]
        )
    ),
    CONSTRAINT rooms_status_check CHECK (
        status = ANY (
            ARRAY['waiting'::text, 'active'::text, 'ended'::text]
        )
    )
) TABLESPACE pg_default;

-- Create messages table
CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    room_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    encrypted_content text NULL,
    iv text NULL,
    sender_public_key text NULL,
    is_encrypted boolean NULL DEFAULT false,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT check_encrypted_message_fields CHECK (
        (
            (is_encrypted = false)
            OR (
                (is_encrypted = true)
                AND (encrypted_content IS NOT NULL)
                AND (iv IS NOT NULL)
                AND (sender_public_key IS NOT NULL)
            )
        )
    ),
    CONSTRAINT check_non_encrypted_message_fields CHECK (
        (
            (is_encrypted = true)
            OR (
                (is_encrypted = false)
                AND (encrypted_content IS NULL)
                AND (iv IS NULL)
                AND (sender_public_key IS NULL)
            )
        )
    )
) TABLESPACE pg_default;

-- Create room_participants table
CREATE TABLE public.room_participants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid NULL,
    user_id uuid NULL,
    joined_at timestamp with time zone NULL DEFAULT now(),
    last_activity timestamp with time zone NULL DEFAULT now(),
    is_active boolean NULL DEFAULT true,
    CONSTRAINT room_participants_pkey PRIMARY KEY (id),
    CONSTRAINT room_participants_room_id_user_id_key UNIQUE (room_id, user_id),
    CONSTRAINT room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT room_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create room_keys table
CREATE TABLE public.room_keys (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL,
    participant_public_key text NOT NULL,
    encrypted_room_key text NOT NULL,
    shared_by uuid NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT room_keys_pkey PRIMARY KEY (id),
    CONSTRAINT room_keys_room_id_participant_public_key_key UNIQUE (room_id, participant_public_key),
    CONSTRAINT room_keys_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT room_keys_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_mood_status ON public.rooms USING btree (mood, status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_rooms_status_mood ON public.rooms USING btree (status, mood) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_rooms_user1 ON public.rooms USING btree (user1_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_rooms_user2 ON public.rooms USING btree (user2_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_rooms_status_users ON public.rooms USING btree (status, user1_id, user2_id) TABLESPACE pg_default;

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages USING btree (room_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_room_id_created ON public.messages USING btree (room_id, created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages USING btree (room_id, created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON public.messages USING btree (room_id, is_encrypted) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_sender_public_key ON public.messages USING btree (sender_public_key) TABLESPACE pg_default;

-- Room participants indexes
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON public.room_participants USING btree (room_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_room_participants_activity ON public.room_participants USING btree (last_activity) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_room_participants_user_room ON public.room_participants USING btree (user_id, room_id, is_active) TABLESPACE pg_default;

-- Room keys indexes
CREATE INDEX IF NOT EXISTS idx_room_keys_room_participant ON public.room_keys USING btree (room_id, participant_public_key) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_room_keys_shared_by ON public.room_keys USING btree (shared_by) TABLESPACE pg_default;

-- =====================================================
-- 4. CREATE FUNCTIONS
-- =====================================================

-- Function: update_room_updated_at
CREATE OR REPLACE FUNCTION public.update_room_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Function: cleanup_ended_room_messages
CREATE OR REPLACE FUNCTION public.cleanup_ended_room_messages()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
BEGIN
    -- If room status changed to 'ended', delete all messages
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        DELETE FROM messages WHERE room_id = NEW.id;
        DELETE FROM room_participants WHERE room_id = NEW.id;
        
        -- Also clear the encryption key for security
        NEW.encryption_key = NULL;
        
        RAISE NOTICE 'Cleaned up messages and participants for ended room: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Function: cleanup_room_keys
CREATE OR REPLACE FUNCTION public.cleanup_room_keys()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        DELETE FROM room_keys WHERE room_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$function$;

-- Function: cleanup_waiting_rooms
CREATE OR REPLACE FUNCTION public.cleanup_waiting_rooms()
    RETURNS void
    LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM rooms 
    WHERE status = 'waiting' 
    AND created_at < NOW() - INTERVAL '1 hour';
END;
$function$;

-- Function: end_inactive_rooms
CREATE OR REPLACE FUNCTION public.end_inactive_rooms()
    RETURNS integer
    LANGUAGE plpgsql
AS $function$
DECLARE
    inactive_count INTEGER := 0;
    room_record RECORD;
BEGIN
    -- Find rooms where all participants have been inactive for more than 2 minutes
    FOR room_record IN
        SELECT r.id, r.status
        FROM rooms r
        WHERE r.status = 'active'
        AND NOT EXISTS (
            SELECT 1 
            FROM room_participants rp 
            WHERE rp.room_id = r.id 
            AND rp.last_activity > NOW() - INTERVAL '2 minutes'
            AND rp.is_active = TRUE
        )
    LOOP
        -- End the room due to inactivity
        UPDATE rooms 
        SET status = 'ended', 
            ended_at = NOW(), 
            end_reason = 'inactivity'
        WHERE id = room_record.id;
        
        inactive_count := inactive_count + 1;
        
        RAISE NOTICE 'Ended inactive room: %', room_record.id;
    END LOOP;
    
    RETURN inactive_count;
END;
$function$;

-- Function: get_room_encryption_status
CREATE OR REPLACE FUNCTION public.get_room_encryption_status(room_uuid uuid)
    RETURNS TABLE(room_id uuid, has_encryption_keys boolean, participant_count bigint, keys_count bigint)
    LANGUAGE plpgsql
AS $function$
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
$function$;

-- Function: join_room_participant
CREATE OR REPLACE FUNCTION public.join_room_participant(p_room_id uuid, p_user_id uuid)
    RETURNS void
    LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO room_participants (room_id, user_id, last_activity, is_active)
    VALUES (p_room_id, p_user_id, NOW(), TRUE)
    ON CONFLICT (room_id, user_id) 
    DO UPDATE SET 
        last_activity = NOW(),
        is_active = TRUE,
        joined_at = CASE 
            WHEN room_participants.is_active = FALSE THEN NOW()
            ELSE room_participants.joined_at
        END;
END;
$function$;

-- Function: leave_room_participant
CREATE OR REPLACE FUNCTION public.leave_room_participant(p_room_id uuid, p_user_id uuid)
    RETURNS void
    LANGUAGE plpgsql
AS $function$
BEGIN
    -- Mark participant as inactive
    UPDATE room_participants 
    SET is_active = FALSE
    WHERE room_id = p_room_id AND user_id = p_user_id;
    
    -- Check if this was the last active participant
    IF NOT EXISTS (
        SELECT 1 FROM room_participants 
        WHERE room_id = p_room_id AND is_active = TRUE
    ) THEN
        -- End the room if no active participants remain
        UPDATE rooms 
        SET status = 'ended', 
            ended_at = NOW(), 
            end_reason = 'manual'
        WHERE id = p_room_id;
    END IF;
END;
$function$;

-- Function: cleanup_old_rooms
CREATE OR REPLACE FUNCTION public.cleanup_old_rooms()
    RETURNS integer
    LANGUAGE plpgsql
AS $function$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- End rooms that have been inactive for more than 5 minutes (safety buffer)
    UPDATE rooms 
    SET status = 'ended', 
        ended_at = NOW(), 
        end_reason = 'cleanup'
    WHERE status = 'active' 
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (
        SELECT 1 
        FROM room_participants rp 
        WHERE rp.room_id = rooms.id 
        AND rp.last_activity > NOW() - INTERVAL '5 minutes'
        AND rp.is_active = TRUE
    );
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Delete old ended rooms (older than 1 hour)
    DELETE FROM rooms 
    WHERE status = 'ended' 
    AND (ended_at < NOW() - INTERVAL '1 hour' OR created_at < NOW() - INTERVAL '1 hour');
    
    RETURN cleanup_count;
END;
$function$;

-- Function: delete_old_encrypted_messages
CREATE OR REPLACE FUNCTION public.delete_old_encrypted_messages(days_old integer)
    RETURNS integer
    LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE is_encrypted = true 
    AND created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$function$;

-- Function: update_participant_activity
CREATE OR REPLACE FUNCTION public.update_participant_activity(p_room_id uuid, p_user_id uuid)
    RETURNS void
    LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE room_participants 
    SET last_activity = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;
END;
$function$;

-- =====================================================
-- 5. CREATE TRIGGERS
-- =====================================================

-- Trigger: update_rooms_updated_at
CREATE TRIGGER update_rooms_updated_at 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_room_updated_at();

-- Trigger: trigger_cleanup_ended_room
CREATE TRIGGER trigger_cleanup_ended_room 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION cleanup_ended_room_messages();

-- Trigger: trigger_cleanup_room_keys
CREATE TRIGGER trigger_cleanup_room_keys 
    AFTER UPDATE ON rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION cleanup_room_keys();

-- =====================================================
-- 6. CREATE VIEWS
-- =====================================================

-- Create admin_messages_view
CREATE VIEW public.admin_messages_view AS
SELECT
    id,
    room_id,
    sender_id,
    CASE
        WHEN is_encrypted THEN '[ENCRYPTED MESSAGE]'::text
        ELSE content
    END AS display_content,
    created_at,
    is_encrypted,
    CASE
        WHEN is_encrypted THEN 'AES-256-GCM'::text
        ELSE 'NONE'::text
    END AS encryption_type,
    length(encrypted_content) AS encrypted_size,
    sender_public_key IS NOT NULL AS has_sender_key
FROM messages m;

-- =====================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_keys ENABLE ROW LEVEL SECURITY;

-- ROOMS POLICIES
CREATE POLICY "Users can create waiting rooms" ON public.rooms
    FOR INSERT TO public
    WITH CHECK (
        (user1_id = auth.uid()) 
        AND (user2_id IS NULL) 
        AND (status = 'waiting'::text)
    );

CREATE POLICY "Users can view accessible rooms" ON public.rooms
    FOR SELECT TO public
    USING (
        (user1_id = auth.uid()) 
        OR (user2_id = auth.uid()) 
        OR ((status = 'waiting'::text) AND (user2_id IS NULL)) 
        OR (EXISTS (
            SELECT 1
            FROM room_participants
            WHERE (room_participants.room_id = rooms.id) 
            AND (room_participants.user_id = auth.uid()) 
            AND (room_participants.is_active = true)
        ))
    );

CREATE POLICY "Users can update their rooms" ON public.rooms
    FOR UPDATE TO public
    USING (
        (user1_id = auth.uid()) 
        OR (user2_id = auth.uid()) 
        OR ((status = 'waiting'::text) AND (user2_id IS NULL))
    )
    WITH CHECK (
        (user1_id = auth.uid()) 
        OR (user2_id = auth.uid())
    );

CREATE POLICY "Room creators can delete rooms" ON public.rooms
    FOR DELETE TO public
    USING (user1_id = auth.uid());

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages in their rooms" ON public.messages
    FOR SELECT TO public
    USING (
        (EXISTS (
            SELECT 1
            FROM rooms
            WHERE (rooms.id = messages.room_id) 
            AND ((rooms.user1_id = auth.uid()) OR (rooms.user2_id = auth.uid()))
        )) 
        OR (EXISTS (
            SELECT 1
            FROM room_participants
            WHERE (room_participants.room_id = messages.room_id) 
            AND (room_participants.user_id = auth.uid()) 
            AND (room_participants.is_active = true)
        ))
    );

CREATE POLICY "Users can send messages to their rooms" ON public.messages
    FOR INSERT TO public
    WITH CHECK (
        (sender_id = auth.uid()) 
        AND (
            (EXISTS (
                SELECT 1
                FROM rooms
                WHERE (rooms.id = messages.room_id) 
                AND ((rooms.user1_id = auth.uid()) OR (rooms.user2_id = auth.uid())) 
                AND (rooms.status = 'active'::text)
            )) 
            OR (EXISTS (
                SELECT 1
                FROM room_participants
                WHERE (room_participants.room_id = messages.room_id) 
                AND (room_participants.user_id = auth.uid()) 
                AND (room_participants.is_active = true)
            ))
        )
    );

CREATE POLICY "Users can send encrypted messages to their rooms" ON public.messages
    FOR INSERT TO public
    WITH CHECK (
        (sender_id = auth.uid()) 
        AND (
            (EXISTS (
                SELECT 1
                FROM rooms r
                WHERE (r.id = messages.room_id) 
                AND ((r.user1_id = auth.uid()) OR (r.user2_id = auth.uid())) 
                AND (r.status = 'active'::text)
            )) 
            OR (EXISTS (
                SELECT 1
                FROM room_participants rp
                WHERE (rp.room_id = messages.room_id) 
                AND (rp.user_id = auth.uid()) 
                AND (rp.is_active = true)
            ))
        )
    );

-- ROOM_PARTICIPANTS POLICIES
CREATE POLICY "Users can view their own participation records" ON public.room_participants
    FOR SELECT TO public
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own participation records" ON public.room_participants
    FOR INSERT TO public
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation records" ON public.room_participants
    FOR UPDATE TO public
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own participation records" ON public.room_participants
    FOR DELETE TO public
    USING (user_id = auth.uid());

-- ROOM_KEYS POLICIES
CREATE POLICY "Users can read their room keys" ON public.room_keys
    FOR SELECT TO public
    USING (
        (EXISTS (
            SELECT 1
            FROM rooms r
            WHERE (r.id = room_keys.room_id) 
            AND ((r.user1_id = auth.uid()) OR (r.user2_id = auth.uid()))
        )) 
        OR (EXISTS (
            SELECT 1
            FROM room_participants rp
            WHERE (rp.room_id = room_keys.room_id) 
            AND (rp.user_id = auth.uid()) 
            AND (rp.is_active = true)
        ))
    );

CREATE POLICY "Users can share room keys" ON public.room_keys
    FOR INSERT TO public
    WITH CHECK (
        (shared_by = auth.uid()) 
        AND (
            (EXISTS (
                SELECT 1
                FROM rooms r
                WHERE (r.id = room_keys.room_id) 
                AND ((r.user1_id = auth.uid()) OR (r.user2_id = auth.uid()))
            )) 
            OR (EXISTS (
                SELECT 1
                FROM room_participants rp
                WHERE (rp.room_id = room_keys.room_id) 
                AND (rp.user_id = auth.uid()) 
                AND (rp.is_active = true)
            ))
        )
    );

CREATE POLICY "Users can update their shared keys" ON public.room_keys
    FOR UPDATE TO public
    USING (shared_by = auth.uid())
    WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Users can delete their shared keys" ON public.room_keys
    FOR DELETE TO public
    USING (shared_by = auth.uid());

-- =====================================================
-- SCRIPT COMPLETION
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Success message
SELECT 'Database schema recreated successfully!' as message;