import { supabase } from './supabase';

export type Mood = 'happy' | 'sad' | 'excited' | 'anxious' | 'calm' | 'angry';

export const joinOrCreateRoom = async (mood: Mood, userId: string) => {
  try {
    console.log(`User ${userId} trying to join ${mood} room...`);
    
    // First, try to find an existing waiting room with the same mood
    const { data: existingRooms, error: findError } = await supabase
      .from('rooms')
      .select('*')
      .eq('mood', mood)
      .eq('status', 'waiting')
      .is('user2_id', null)
      .neq('user1_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (findError) {
      console.error('Error finding rooms:', findError);
      throw findError;
    }

    console.log('Found existing rooms:', existingRooms);

    if (existingRooms && existingRooms.length > 0) {
      const roomToJoin = existingRooms[0];
      console.log(`Joining existing room: ${roomToJoin.id}`);
      
      // Try to join the existing room
      const { data: updatedRoom, error: updateError } = await supabase
        .from('rooms')
        .update({
          user2_id: userId,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', roomToJoin.id)
        .eq('status', 'waiting') // Make sure it's still waiting
        .is('user2_id', null) // Make sure no one else joined
        .select()
        .single();

      if (updateError) {
        console.error('Error updating room:', updateError);
        // If update failed, maybe someone else joined, try creating new room
      } else if (updatedRoom) {
        console.log('Successfully joined room:', updatedRoom);
        return updatedRoom;
      }
    }

    // If no room found or joining failed, create a new room
    console.log('Creating new room...');
    const { data: newRoom, error: createError } = await supabase
      .from('rooms')
      .insert({
        mood,
        user1_id: userId,
        status: 'waiting'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating room:', createError);
      throw createError;
    }

    console.log('Created new room:', newRoom);
    return newRoom;
    
  } catch (error) {
    console.error('Error in joinOrCreateRoom:', error);
    throw error;
  }
};

export const leaveRoom = async (roomId: string) => {
  try {
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'ended' })
      .eq('id', roomId);

    if (error) throw error;
  } catch (error) {
    console.error('Error leaving room:', error);
    throw error;
  }
};

export const sendMessage = async (roomId: string, senderId: string, content: string) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        content
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};