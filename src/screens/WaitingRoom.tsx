import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';

type WaitingRoomScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'WaitingRoom'
>;

type WaitingRoomScreenRouteProp = RouteProp<RootStackParamList, 'WaitingRoom'>;

interface Props {
  navigation: WaitingRoomScreenNavigationProp;
  route: WaitingRoomScreenRouteProp;
}

export default function WaitingRoom({ navigation, route }: Props) {
  const { mood } = route.params;
  const [isWaiting, setIsWaiting] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string>('');
  const [currentRoomId, setCurrentRoomId] = React.useState<string>('');

  React.useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  React.useEffect(() => {
    if (!currentUserId) return;

    let subscription: any = null;

    const findMatchOrCreateRoom = async () => {
      try {
        console.log(`🔍 Searching room for mood: ${mood}, user: ${currentUserId}`);

        // Step 1: Check if this user already has ANY room (as user1 OR user2)
        console.log('🔍 Step 1: Checking for existing user room...');
        const { data: existingRoom, error: existingError } = await supabase
          .from('rooms')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .in('status', ['waiting', 'active'])
          .maybeSingle();

        if (existingError) {
          console.error('❌ Error fetching user room:', existingError);
        }

        console.log('🔍 Existing room for user:', existingRoom);

        // If user already has a room, use it
        if (existingRoom) {
          console.log('📍 Using existing room:', existingRoom.id);
          setCurrentRoomId(existingRoom.id);
          
          // If room is already active, go straight to chat
          if (existingRoom.status === 'active') {
            console.log('🎉 Room already active! Going to chat...');
            setIsWaiting(false);
            navigation.replace('Chat', { roomId: existingRoom.id, mood });
            return;
          }
          
          // Set up listener for existing waiting room
          setupRoomListener(existingRoom.id);
          return;
        }

        // Step 2: Try to find a waiting room to join
        console.log('📍 Step 2: No existing room, searching for matches...');
        
        const { data: waitingRooms, error: searchError } = await supabase
          .from('rooms')
          .select('*')
          .eq('status', 'waiting')
          .eq('mood', mood)
          .is('user2_id', null)
          .neq('user1_id', currentUserId)
          .order('created_at', { ascending: true })
          .limit(1);

        if (searchError) {
          console.error('❌ Search error:', searchError);
          Alert.alert('Error', 'Could not find a room. Try again.');
          return;
        }

        console.log('📍 Found waiting rooms:', waitingRooms);

        if (waitingRooms && waitingRooms.length > 0) {
          const waitingRoom = waitingRooms[0];
          console.log('🚪 Attempting to join room:', waitingRoom.id);

          const { data: updatedRoom, error: updateError } = await supabase
            .from('rooms')
            .update({
              user2_id: currentUserId,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', waitingRoom.id)
            .eq('status', 'waiting')
            .is('user2_id', null)
            .select()
            .maybeSingle();

          console.log('🚪 Update result:', updatedRoom);
          console.log('🚪 Update error:', updateError);

          if (!updateError && updatedRoom) {
            console.log('✅ Successfully joined room:', updatedRoom.id);
            setIsWaiting(false);
            navigation.replace('Chat', { roomId: updatedRoom.id, mood });
            return;
          } else {
            console.warn('⚠️ Failed to join room, creating new one:', updateError);
          }
        } else {
          console.log('📍 No waiting rooms found to join');
        }

        // Step 3: Create a new room only if no existing room and can't join any
        console.log('➕ Creating new room...');
        const { data: newRoom, error: createError } = await supabase
          .from('rooms')
          .insert({
            user1_id: currentUserId,
            user2_id: null,
            mood: mood,
            status: 'waiting',
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Room creation error:', createError);
          Alert.alert('Error', 'Could not create a room.');
          return;
        }

        console.log('✅ Room created:', newRoom.id);
        setCurrentRoomId(newRoom.id);
        setupRoomListener(newRoom.id);

      } catch (err) {
        console.error('❌ Unexpected error:', err);
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
    };

    const setupRoomListener = (roomId: string) => {
      console.log('📡 Setting up subscription for room:', roomId);
      const channelName = `room-${roomId}-${Date.now()}`;
      subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            const updatedRoom = payload.new;
            console.log('🔄 Room updated:', updatedRoom);

            if (updatedRoom.status === 'active' && updatedRoom.user2_id) {
              console.log('🎉 Room now active! Navigating to chat...');
              setIsWaiting(false);
              navigation.replace('Chat', { roomId: updatedRoom.id, mood });
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
        });
    };

    findMatchOrCreateRoom();

    return () => {
      if (subscription) {
        console.log('🧹 Cleaning up subscription');
        subscription.unsubscribe();
      }
    };
  }, [currentUserId, mood, navigation]);

  const handleCancel = async () => {
    try {
      // Delete any waiting room created by this user
      if (currentUserId) {
        await supabase
          .from('rooms')
          .delete()
          .eq('user1_id', currentUserId)
          .eq('status', 'waiting');
      }
      
      await supabase.auth.signOut();
      navigation.navigate('Onboarding');
    } catch (error) {
      console.error('Error canceling:', error);
      Alert.alert('Error', 'Failed to cancel. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.title}>
          {isWaiting ? 'Finding someone...' : 'Match found!'}
        </Text>
        <Text style={styles.subtitle}>
          {isWaiting 
            ? `Looking for someone else feeling ${mood}` 
            : 'Joining chat room...'
          }
        </Text>
        
        {isWaiting && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});