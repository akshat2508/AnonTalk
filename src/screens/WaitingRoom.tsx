
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
  happy: '😊',
  sad: '😢',
  excited: '🤩',
  anxious: '😰',
  calm: '😌',
  angry: '😠',
};

const moodColors: { [key: string]: readonly [string, string] } = {
  happy: ['#FFD93D', '#FFED4E'] as const,
  sad: ['#6BB6FF', '#9DCEFF'] as const,
  excited: ['#FF6B6B', '#FF8E8E'] as const,
  anxious: ['#DDA0DD', '#E6B8E6'] as const,
  calm: ['#98FB98', '#B8FFB8'] as const,
  angry: ['#FF4500', '#FF6B2B'] as const,
};

export default function WaitingRoom({ navigation, route }: Props) {
  const { mood } = route.params;
  const [isWaiting, setIsWaiting] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string>('');
  const [currentRoomId, setCurrentRoomId] = React.useState<string>('');
  const [searchStatus, setSearchStatus] = React.useState('Initializing...');
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Animation values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const dotsAnim = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const rippleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Initial entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Animated dots
    const animateDots = () => {
      const staggerDelay = 200;
      const animations = dotsAnim.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * staggerDelay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.parallel(animations).start();
    };
    animateDots();

    // Ripple effect
    const rippleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    rippleAnimation.start();

    return () => {
      pulseAnimation.stop();
      rippleAnimation.stop();
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

    let subscription: any = null;

    const findMatchOrCreateRoom = async () => {
      try {
        console.log(`🔍 Searching room for mood: ${mood}, user: ${currentUserId}`);
        setSearchStatus('Scanning for matches...');

        // Step 1: Check if this user already has ANY room (as user1 OR user2)
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
            setSearchStatus('Match found! Connecting...');
            navigation.replace('Chat', { roomId: existingRoom.id, mood });
            return;
          }
          setupRoomListener(existingRoom.id);
          setSearchStatus('Waiting for someone to join...');
          return;
        }

        // Step 2: Try to join an available waiting room
        setSearchStatus('Looking for available rooms...');
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
          setSearchStatus('Joining room...');
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

          if (!updateError && updatedRoom) {
            setIsWaiting(false);
            setSearchStatus('Connected! Starting chat...');
            navigation.replace('Chat', { roomId: updatedRoom.id, mood });
            return;
          }
        }

        // Step 3: Create new room
        setSearchStatus('Creating your room...');
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
        setSearchStatus('Room created! Waiting for someone...');

      } catch (err) {
        console.error('❌ Unexpected error:', err);
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
    };

    const setupRoomListener = (roomId: string) => {
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
            if (updatedRoom.status === 'active' && updatedRoom.user2_id) {
              setIsWaiting(false);
              setSearchStatus('Someone joined! Starting chat...');
              navigation.replace('Chat', { roomId: updatedRoom.id, mood });

              // clear timeout once match is found
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
        });
    };

    findMatchOrCreateRoom();

    // Set random timeout (1 to 3 minutes)
    const timeoutMinutes = Math.floor(Math.random() * 3) + 1;
    const timeoutDuration = timeoutMinutes * 60 * 1000;
    console.log(`⏳ Timeout set for ${timeoutMinutes} minute(s)`);

    timeoutRef.current = setTimeout(() => {
      if (isWaiting) {
        console.log('⏱️ Timeout reached. Cancelling room.');
        Alert.alert(
          'No match found',
          'Could not find a match in time. Please try again.',
          [
            {
              text: 'Okay',
              onPress: handleCancel,
            },
          ]
        );
      }
    }, timeoutDuration);

    return () => {
      if (subscription) subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentUserId, mood, navigation]);

  const handleCancel = async () => {
    try {
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
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Animated Background Circles */}
            <View style={styles.backgroundElements}>
              <Animated.View 
                style={[
                  styles.ripple1,
                  {
                    opacity: rippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 0],
                    }),
                    transform: [{
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 3],
                      }),
                    }],
                  },
                ]}
              />
              <Animated.View 
                style={[
                  styles.ripple2,
                  {
                    opacity: rippleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.15, 0],
                    }),
                    transform: [{
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.5],
                      }),
                    }],
                  },
                ]}
              />
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              {/* Mood Display */}
              <Animated.View 
                style={[
                  styles.moodContainer,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <BlurView intensity={20} style={styles.moodBlur}>
                  <LinearGradient
                    colors={moodColors[mood] || ['#6C5CE7', '#A29BFE']}
                    style={styles.moodGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.moodContent}>
                      <Text style={styles.moodEmoji}>
                        {moodEmojis[mood] || '😊'}
                      </Text>
                      <Text style={styles.moodText}>{mood}</Text>
                    </View>
                  </LinearGradient>
                </BlurView>
              </Animated.View>

              {/* Status Text */}
              <View style={styles.statusContainer}>
                <Text style={styles.title}>
                  {isWaiting ? 'Finding Your Match' : 'Match Found!'}
                </Text>
                <Text style={styles.subtitle}>{searchStatus}</Text>
                
                {/* Animated Dots */}
                {isWaiting && (
                  <View style={styles.dotsContainer}>
                    {dotsAnim.map((anim, index) => (
                      <Animated.View
                        key={index}
                        style={[
                          styles.dot,
                          {
                            opacity: anim,
                            transform: [{
                              scale: anim.interpolate({
                                inputRange: [0.3, 1],
                                outputRange: [0.8, 1.2],
                              }),
                            }],
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Progress Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View 
                    style={[
                      styles.progressFill,
                      {
                        transform: [{
                          scaleX: rippleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.2, 0.8],
                          }),
                        }],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Connecting you with someone special...
                </Text>
              </View>

              {/* Cancel Button */}
              {isWaiting && (
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={10} style={styles.cancelBlur}>
                    <LinearGradient
                      colors={['rgba(255, 68, 68, 0.8)', 'rgba(255, 107, 107, 0.8)']}
                      style={styles.cancelGradient}
                    >
                      <Text style={styles.cancelButtonText}>Cancel Search</Text>
                    </LinearGradient>
                  </BlurView>
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Decoration */}
            <View style={styles.bottomDecoration}>
              <View style={styles.decorativeLine} />
              <Text style={styles.decorativeText}>✨</Text>
              <View style={styles.decorativeLine} />
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
    justifyContent: 'space-between',
    padding: 24,
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#6C5CE7',
  },
  ripple2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#A29BFE',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodContainer: {
    marginBottom: 40,
  },
  moodBlur: {
    borderRadius: 80,
    overflow: 'hidden',
  },
  moodGradient: {
    padding: 3,
    borderRadius: 80,
  },
  moodContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 77,
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  moodText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    textTransform: 'capitalize',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5CE7',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressTrack: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 2,
    transformOrigin: 'left',
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cancelButton: {
    borderRadius: 25,
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
  cancelBlur: {
    borderRadius: 25,
  },
  cancelGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 20,
  },
  decorativeLine: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  decorativeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});