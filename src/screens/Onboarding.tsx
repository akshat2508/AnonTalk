import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { joinOrCreateRoom, Mood } from '../lib/room';

type OnboardingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

const moods: { key: Mood; emoji: string; label: string; color: string }[] = [
  { key: 'happy', emoji: '😊', label: 'Happy', color: '#FFD93D' },
  { key: 'sad', emoji: '😢', label: 'Sad', color: '#6BB6FF' },
  { key: 'excited', emoji: '🤩', label: 'Excited', color: '#FF6B6B' },
  { key: 'anxious', emoji: '😰', label: 'Anxious', color: '#DDA0DD' },
  { key: 'calm', emoji: '😌', label: 'Calm', color: '#98FB98' },
  { key: 'angry', emoji: '😠', label: 'Angry', color: '#FF4500' },
];

export default function Onboarding({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [selectedMood, setSelectedMood] = React.useState<Mood | null>(null);

  const handleMoodSelection = async (mood: Mood) => {
    if (loading) return;
    
    setLoading(true);
    setSelectedMood(mood);
    
    try {
      console.log(`Selected mood: ${mood}`);
      
      // Sign in anonymously
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }
      
      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Failed to get user ID');
      }

      console.log(`User ID: ${userId}`);

      // Wait a bit to ensure auth is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Join or create room
      const room = await joinOrCreateRoom(mood, userId);
      
      console.log('Room result:', room);
      
      if (room.status === 'active') {
        // Room is immediately active (joined existing room)
        console.log('Navigating to Chat - room is active');
        navigation.replace('Chat', { roomId: room.id, mood });
      } else {
        // Room is waiting (created new room)
        console.log('Navigating to WaitingRoom - room is waiting');
        navigation.replace('WaitingRoom', { mood });
      }
    } catch (error) {
      console.error('Error selecting mood:', error);
      Alert.alert('Error', 'Failed to connect. Please try again.');
    } finally {
      setLoading(false);
      setSelectedMood(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AnonTalk</Text>
        <Text style={styles.subtitle}>How are you feeling today?</Text>
        
        <View style={styles.moodGrid}>
          {moods.map((mood) => (
            <TouchableOpacity
              key={mood.key}
              style={[
                styles.moodButton, 
                { backgroundColor: mood.color },
                loading && selectedMood === mood.key && styles.selectedMood
              ]}
              onPress={() => handleMoodSelection(mood.key)}
              disabled={loading}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text style={styles.moodLabel}>
                {loading && selectedMood === mood.key ? 'Connecting...' : mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Text style={styles.description}>
          Select your mood to connect with someone feeling the same way
        </Text>
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
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  moodButton: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectedMood: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moodEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  description: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});