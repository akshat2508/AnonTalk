
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { joinOrCreateRoom, Mood } from '../lib/room';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type OnboardingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const moods: { key: Mood; emoji: string; label: string; colors: readonly [string, string] }[] = [
  { key: 'happy', emoji: '😊', label: 'Happy', colors: ['#FFD93D', '#FFED4E'] as const },
  { key: 'sad', emoji: '😢', label: 'Sad', colors: ['#6BB6FF', '#9DCEFF'] as const },
  { key: 'excited', emoji: '🤩', label: 'Excited', colors: ['#FF6B6B', '#FF8E8E'] as const },
  { key: 'anxious', emoji: '😰', label: 'Anxious', colors: ['#DDA0DD', '#E6B8E6'] as const },
  { key: 'calm', emoji: '😌', label: 'Calm', colors: ['#98FB98', '#B8FFB8'] as const },
  { key: 'angry', emoji: '😠', label: 'Angry', colors: ['#FF4500', '#FF6B2B'] as const },
];

export default function Onboarding({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [selectedMood, setSelectedMood] = React.useState<Mood | null>(null);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const moodAnimations = React.useRef(
    moods.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered mood button animations
    const staggerDelay = 100;
    moodAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: 400 + index * staggerDelay,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const handleMoodSelection = async (mood: Mood) => {
    if (loading) return;
    
    setLoading(true);
    setSelectedMood(mood);
    
    // Button press animation
    const moodIndex = moods.findIndex(m => m.key === mood);
    Animated.sequence([
      Animated.timing(moodAnimations[moodIndex], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(moodAnimations[moodIndex], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
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
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0F0F23', '#1A1A2E', '#16213E']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Header Section */}
            <View style={styles.header}>
              <Text style={styles.title}>AnonTalk</Text>
              <View style={styles.titleUnderline} />
              <Text style={styles.subtitle}>How are you feeling today?</Text>
              <Text style={styles.description}>
                Connect with someone who understands your vibe ✨
              </Text>
            </View>
            
            {/* Mood Grid */}
            <View style={styles.moodContainer}>
              <View style={styles.moodGrid}>
                {moods.map((mood, index) => (
                  <Animated.View
                    key={mood.key}
                    style={[
                      styles.moodButtonContainer,
                      {
                        opacity: moodAnimations[index],
                        transform: [
                          {
                            translateY: moodAnimations[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [50, 0],
                            }),
                          },
                          {
                            scale: moodAnimations[index],
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.moodButton,
                        loading && selectedMood === mood.key && styles.selectedMood
                      ]}
                      onPress={() => handleMoodSelection(mood.key)}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <BlurView intensity={20} style={styles.blurContainer}>
                        <LinearGradient
                          colors={mood.colors}
                          style={styles.gradientBackground}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.moodContent}>
                            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                            <Text style={styles.moodLabel}>
                              {loading && selectedMood === mood.key ? 'Connecting...' : mood.label}
                            </Text>
                            {loading && selectedMood === mood.key && (
                              <View style={styles.loadingDots}>
                                <View style={styles.dot} />
                                <View style={styles.dot} />
                                <View style={styles.dot} />
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      </BlurView>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDots}>
                {[...Array(3)].map((_, i) => (
                  <View key={i} style={styles.footerDot} />
                ))}
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    backgroundColor: '#6C5CE7',
    borderRadius: 2,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  moodContainer: {
    flex: 0.6,
    justifyContent: 'center',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  moodButtonContainer: {
    width: '48%',
    marginBottom: 16,
  },
  moodButton: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  blurContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientBackground: {
    borderRadius: 24,
    padding: 2,
  },
  moodContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  selectedMood: {
    transform: [{ scale: 0.95 }],
  },
  moodEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C5CE7',
  },
  footer: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerDots: {
    flexDirection: 'row',
    gap: 8,
  },
  footerDot: {
    
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(19, 10, 98, 0.3)',
  },
});