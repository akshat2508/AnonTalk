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
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { RealtimeChannel } from '@supabase/supabase-js';

type WaitingRoomScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'WaitingRoom'
>;

type WaitingRoomScreenRouteProp = RouteProp<RootStackParamList, 'WaitingRoom'>;

interface Props {
  navigation: WaitingRoomScreenNavigationProp;
  route: WaitingRoomScreenRouteProp;
}

const { width, height } = Dimensions.get('window');

const moodEmojis: { [key: string]: string } = {
  happy: '✨',
  sad: '💔',
  horny: '🔥',
  anxious: '💀',
  calm: '🌊',
  angry: '😈',
};

const moodColors: { [key: string]: readonly [string, string] } = {
  happy: ['#FF6B9D', '#FEC163'] as const,
  sad: ['#4158D0', '#C850C0'] as const,
  horny: ['#FF0080', '#FF8C00'] as const,
  anxious: ['#8B5CF6', '#EC4899'] as const,
  calm: ['#06B6D4', '#3B82F6'] as const,
  angry: ['#DC2626', '#F59E0B'] as const,
};

const moodLabels: { [key: string]: string } = {
  happy: 'Vibing',
  sad: 'Down Bad',
  horny: 'Feeling Spicy',
  anxious: 'Overthinking',
  calm: 'Chilling',
  angry: 'On Demon Time',
};

export default function WaitingRoom({ navigation, route }: Props) {
  // Map old "excited" to new "horny" for backwards compatibility
  const rawMood = route.params.mood;
  const mood = rawMood === 'excited' ? 'horny' : rawMood;
  const [isWaiting, setIsWaiting] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string>('');
  const [currentRoomId, setCurrentRoomId] = React.useState<string>('');
  const [searchStatus, setSearchStatus] = React.useState('loading your vibe...');
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = React.useRef<RealtimeChannel | null>(null);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = React.useRef(true);

  // Animation values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Initial entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous rotation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    // Pulse glow
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    glowAnimation.start();

    // Float animation
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    floatAnimation.start();

    // Pulse scale
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      isMountedRef.current = false;
      rotateAnimation.stop();
      glowAnimation.stop();
      floatAnimation.stop();
      pulseAnimation.stop();
      
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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

    const findMatchOrCreateRoom = async () => {
      try {
        console.log(`🔍 Searching room for mood: ${mood}, user: ${currentUserId}`);
        setSearchStatus('scanning the vibe check...');

        const { data: existingRoom, error: existingError } = await supabase
          .from('rooms')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .in('status', ['waiting', 'active'])
          .maybeSingle();

        if (existingError) {
          console.error('❌ Error fetching user room:', existingError);
        }

        if (existingRoom) {
          setCurrentRoomId(existingRoom.id);
          if (existingRoom.status === 'active') {
            setIsWaiting(false);
            setSearchStatus('Match Incoming! 🚀');
            if (isMountedRef.current) {
              navigation.replace('Chat', { roomId: existingRoom.id, mood });
            }
            return;
          }
          setupRoomListener(existingRoom.id);
          setSearchStatus('Waiting for Someone to Slide in...');
          return;
        }

        setSearchStatus('looking for your twin flame...');
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

        if (waitingRooms && waitingRooms.length > 0) {
          const waitingRoom = waitingRooms[0];
          setSearchStatus('found someone! joining now...');
          
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
            .neq('user1_id', currentUserId)
            .select()
            .maybeSingle();

          if (!updateError && updatedRoom) {
            setIsWaiting(false);
            setSearchStatus('you\'re in! let\'s go 💬');
            if (isMountedRef.current) {
              navigation.replace('Chat', { roomId: updatedRoom.id, mood });
            }
            return;
          } else {
            console.log('⚠️ Failed to join room, creating new one...');
          }
        }

        setSearchStatus('creating your space...');
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

        setCurrentRoomId(newRoom.id);
        setupRoomListener(newRoom.id);
        setSearchStatus('room ready! waiting for your match...');

      } catch (err) {
        console.error('❌ Unexpected error:', err);
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
    };

    const setupRoomListener = (roomId: string) => {
      console.log('🔗 Setting up room listener for:', roomId);
      
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const channelName = `waiting_room_${roomId}_${currentUserId}_${Date.now()}`;
      
      const subscription = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: currentUserId },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            console.log('🏠 Room update received in WaitingRoom:', payload.new);
            const updatedRoom = payload.new;
            
            if (updatedRoom.status === 'active' && updatedRoom.user2_id && isMountedRef.current) {
              console.log('✅ Room became active, navigating to chat...');
              setIsWaiting(false);
              setSearchStatus('someone slid in! 🎉');
              
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              
              setTimeout(() => {
                if (isMountedRef.current) {
                  navigation.replace('Chat', { roomId: updatedRoom.id, mood });
                }
              }, 500);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('📡 WaitingRoom subscription status:', status);
          if (err) {
            console.error('❌ WaitingRoom subscription error:', err);
          }
        });

      subscriptionRef.current = subscription;

      pollIntervalRef.current = setInterval(async () => {
        try {
          const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();

          if (error) {
            return;
          }

          if (room?.status === 'active' && room.user2_id && isMountedRef.current) {
            console.log('🔄 Polling detected active room, navigating...');
            setIsWaiting(false);
            setSearchStatus('Match locked in! 🔒');
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            navigation.replace('Chat', { roomId: room.id, mood });
          } else if (room?.status === 'ended') {
            console.log('🔄 Polling detected ended room');
            if (isMountedRef.current) {
              navigation.navigate('Onboarding');
            }
          }
        } catch (error) {
          console.error('Error in room polling:', error);
        }
      }, 1500);
    };

    findMatchOrCreateRoom();

    const timeoutMinutes = Math.floor(Math.random() * 3) + 1;
    const timeoutDuration = timeoutMinutes * 60 * 1000;
    console.log(`⏳ Timeout set for ${timeoutMinutes} minute(s)`);

    timeoutRef.current = setTimeout(() => {
      if (isWaiting && isMountedRef.current) {
        console.log('⏱️ Timeout reached. Cancelling room.');
        Alert.alert(
          'no cap, no one showed up 😔',
          'couldn\'t find your vibe twin rn. wanna try again?',
          [
            {
              text: 'Yeah Let\'s go',
              onPress: handleCancel,
            },
          ]
        );
      }
    }, timeoutDuration);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentUserId, mood, navigation, isWaiting]);

  const handleCancel = async () => {
    try {
      if (currentUserId && currentRoomId) {
        await supabase
          .from('rooms')
          .delete()
          .eq('id', currentRoomId)
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

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0a0a0a', '#1a0a1f', '#0f0520']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ scale: bounceAnim }],
              },
            ]}
          >
            {/* Floating gradient orbs */}
            <View style={styles.backgroundElements}>
              <Animated.View 
                style={[
                  styles.orb1,
                  {
                    opacity: glowOpacity,
                    transform: [
                      { translateY: floatY },
                      { rotate: spin },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={moodColors[mood] || ['#FF0080', '#FF8C00']}
                  style={styles.orbGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.orb2,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 0.5],
                    }),
                    transform: [
                      { translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 15],
                      })},
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
                  style={styles.orbGradient}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              </Animated.View>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              {/* Status badge at top */}
              {/* <View style={styles.topBadge}>
                <BlurView intensity={40} style={styles.badgeBlur}>
                  <Text>

                  </Text>
                </BlurView>
              </View> */}

              {/* Giant mood emoji with glow */}
              <Animated.View 
                style={[
                  styles.emojiContainer,
                  {
                    transform: [
                      { scale: pulseAnim },
                      { rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-5deg', '5deg'],
                      })},
                    ],
                  },
                ]}
              >
                <Animated.View style={[styles.emojiGlow, { opacity: glowOpacity }]}>
                  <LinearGradient
                    colors={[...moodColors[mood], 'transparent']}
                    style={styles.glowGradient}
                  />
                </Animated.View>
                <Text style={styles.giantEmoji}>
                  {moodEmojis[mood] || '✨'}
                </Text>
              </Animated.View>

              {/* Mood label with glassmorphism */}
              <View style={styles.moodLabelContainer}>
                <BlurView intensity={30} style={styles.moodLabelBlur}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                    style={styles.moodLabelGradient}
                  >
                    <Text style={styles.moodLabel}>
                      {moodLabels[mood] || mood}
                    </Text>
                  </LinearGradient>
                </BlurView>
              </View>

              {/* Status text with animated typing effect */}
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  {isWaiting ? 'Finding ur vibe twin' : 'Ur match is here!'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {searchStatus}
                </Text>
              </View>

              {/* Loading bar with gradient */}
              {isWaiting && (
                <View style={styles.loadingBarContainer}>
                  <View style={styles.loadingBarTrack}>
                    <Animated.View 
                      style={[
                        styles.loadingBarFill,
                        {
                          transform: [{
                            translateX: rotateAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-width, width * 0.5],
                            }),
                          }],
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={moodColors[mood] || ['#FF0080', '#FF8C00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.loadingGradient}
                      />
                    </Animated.View>
                  </View>
                  <Text style={styles.loadingText}>
                    Hold up, we're cooking 👨‍🍳
                  </Text>
                </View>
              )}

              {/* Cancel button with bold style */}
              {isWaiting && (
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancel}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FF1744', '#F50057']}
                    style={styles.cancelGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.cancelButtonText}>Nah I'm Out</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom hint */}
            <View style={styles.bottomHint}>
              <Text style={styles.hintText}>
                💬 Get Ready To Spill The Tea
              </Text>
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
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb1: {
    position: 'absolute',
    top: height * 0.15,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    overflow: 'hidden',
  },
  orb2: {
    position: 'absolute',
    bottom: height * 0.2,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
  },
  orbGradient: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  topBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeBlur: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  emojiGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 110,
  },
  giantEmoji: {
    fontSize: 120,
    textAlign: 'center',
  },
  moodLabelContainer: {
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 40,
  },
  moodLabelBlur: {
    borderRadius: 30,
  },
  moodLabelGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  moodLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform:'capitalize'
  },
  statusTextContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0,
  },
  statusSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingBarContainer: {
    alignItems: 'center',
    marginBottom: 50,
    width: '100%',
  },
  loadingBarTrack: {
    width: width * 0.75,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loadingBarFill: {
    height: '100%',
    width: width * 0.4,
  },
  loadingGradient: {
    flex: 1,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  cancelButton: {
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cancelGradient: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bottomHint: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
});