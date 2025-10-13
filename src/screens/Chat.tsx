import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { sendMessage, leaveRoom } from '../lib/room';
import type { RealtimeChannel } from '@supabase/supabase-js';
import styles from '../screens/chatStyles';

const { width, height } = Dimensions.get('window');

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface Props {
  navigation: ChatScreenNavigationProp;
  route: ChatScreenRouteProp;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

// Memoized message component to prevent re-renders
const MessageItem = memo<{ 
  item: Message; 
  index: number; 
  currentUserId: string;
  moodColors: any;
  typingAnimValue: Animated.Value;
}>( ({ item, index, currentUserId, moodColors, typingAnimValue }) => {
  const isMyMessage = item.sender_id === currentUserId;
  const isOptimistic = item.id.startsWith('temp-');
  
  const messageAnim = useRef(new Animated.Value(0)).current;
  const messageSlide = useRef(new Animated.Value(isMyMessage ? 80 : -80)).current;
  const messageScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(messageAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(messageSlide, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(messageScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return (
    <Animated.View
      style={{
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 6,
        opacity: messageAnim,
        transform: [
          { translateX: messageSlide },
          { scale: messageScale }
        ],
      }}
    >
      <View
        style={{
          maxWidth: '80%',
          alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
          backgroundColor: isMyMessage ? moodColors.primary : '#1E1E1E',
          borderRadius: 24,
          padding: 16,
          shadowColor: isMyMessage ? moodColors.primary : '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
          borderWidth: 2,
          borderColor: isMyMessage ? moodColors.accent + '40' : '#333',
          opacity: isOptimistic ? 0.6 : 1,
        }}
      >
        {/* Gradient overlay for messages */}
        {isMyMessage && (
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 22,
              overflow: 'hidden',
              opacity: 0.15,
            }}
          >
            <View style={{
              flex: 1,
              backgroundColor: moodColors.secondary,
            }} />
          </View>
        )}
        
        <Text style={{
          fontSize: 16,
          lineHeight: 22,
          color: isMyMessage ? '#FFFFFF' : '#E0E0E0',
          fontWeight: '500',
        }}>
          {item.content}
        </Text>
        
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
          gap: 6,
        }}>
          <Text style={{
            fontSize: 11,
            color: isMyMessage ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)',
            fontWeight: '600',
          }}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          {isOptimistic && (
            <Animated.Text 
              style={{
                fontSize: 12,
                opacity: typingAnimValue
              }}
            >
              ⌛
            </Animated.Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.content === nextProps.item.content &&
         prevProps.currentUserId === nextProps.currentUserId &&
         prevProps.index === nextProps.index;
});

const Chat: React.FC<Props> = ({ navigation, route }) => {
  const { roomId, mood } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [roomEnded, setRoomEnded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Animation values - kept as refs to prevent re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerShineAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;
  const bgRotation = useRef(new Animated.Value(0)).current;
  const borderPulse = useRef(new Animated.Value(1)).current;

  const isRLSError = (error: any): boolean => {
    return error?.code === '42501' || 
           (error?.message && error.message.includes('row-level security policy'));
  };

  const showRoomEndedAlert = useCallback(() => {
    Alert.alert(
      '💀 Session Ghosted',
      'Yo this chat died. Your mystery person bounced. Wanna head back?',
      [
        {
          text: 'Dip Out',
          style: 'default',
          onPress: async () => {
            try {
              await leaveRoom(roomId);
              await supabase.auth.signOut();
              navigation.navigate('Onboarding');
            } catch (error) {
              console.error('Error leaving chat:', error);
              navigation.navigate('Onboarding');
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [roomId, navigation]);

  // Memoized mood emoji getter
  const moodEmoji = useMemo(() => {
    const moodEmojis: Record<string, string> = {
      happy: '🔥',
      sad: '💀',
      horny: '🥵',
      calm: '🌊',
      anxious: '😵‍💫',
      default: '👻',
    };
    return moodEmojis[mood.toLowerCase()] || moodEmojis.default;
  }, [mood]);

  // Memoized mood colors
  const moodColors = useMemo(() => {
    const colors: Record<string, { primary: string; secondary: string; accent: string; gradient: string[] }> = {
      happy: { 
        primary: '#FF3B81', 
        secondary: '#FF6B35', 
        accent: '#FFD23F',
        gradient: ['#FF3B81', '#FF6B35', '#FFD23F']
      },
      sad: { 
        primary: '#6B5CE7', 
        secondary: '#4ECDC4', 
        accent: '#3D5AFE',
        gradient: ['#6B5CE7', '#4ECDC4']
      },
      horny: { 
        primary: '#FF1744', 
        secondary: '#F50057', 
        accent: '#FF4081',
        gradient: ['#FF1744', '#F50057', '#FF69B4']
      },
      calm: { 
        primary: '#00D9FF', 
        secondary: '#00E5A0', 
        accent: '#7C4DFF',
        gradient: ['#00D9FF', '#00E5A0']
      },
      anxious: { 
        primary: '#9D00FF', 
        secondary: '#FF00EA', 
        accent: '#00F5FF',
        gradient: ['#9D00FF', '#FF00EA']
      },
      default: { 
        primary: '#1DB954', 
        secondary: '#1ED760', 
        accent: '#00E676',
        gradient: ['#1DB954', '#1ED760']
      },
    };
    return colors[mood.toLowerCase()] || colors.default;
  }, [mood]);

  // Initial animations - run once
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Background rotation
    Animated.loop(
      Animated.timing(bgRotation, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    // Border pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(borderPulse, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(borderPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Connection pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Separate typing animation effect
  useEffect(() => {
    if (isTyping) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isTyping]);

  // Handle text change without triggering animations
  const handleTextChange = useCallback((text: string) => {
    setNewMessage(text);
    // Only update typing state if it actually changes
    const shouldBeTyping = text.trim().length > 0;
    if (shouldBeTyping !== isTyping) {
      setIsTyping(shouldBeTyping);
    }
  }, [isTyping]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          setIsUserLoaded(true);
          console.log('Current user ID:', user.id);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      console.log('Loading messages for room:', roomId);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
          if (isRLSError(error)) {
            showRoomEndedAlert();
          }
        } else {
          console.log('Loaded messages:', data?.length || 0);
          setMessages(data || []);
        }
      } catch (error) {
        console.error('Error in loadMessages:', error);
      }
    };

    const setupRealtime = async () => {
      console.log('Setting up real-time subscription for room:', roomId);
      
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
      }

      const channel = supabase
        .channel(`room_${roomId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: currentUserId },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log('📨 Real-time message received:', payload);
            const newMessage = payload.new as Message;
            
            setMessages((prev) => {
              const exists = prev.find(m => m.id === newMessage.id);
              if (exists) {
                console.log('⚠️ Message already exists, skipping');
                return prev;
              }
              console.log('✅ Adding new message to state');
              return [...prev, newMessage];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            console.log('🏠 Room update received:', payload.new);
            const room = payload.new;
            if (room.status === 'ended') {
              setIsConnected(false);
              setRoomEnded(true);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('🔗 Subscription status:', status);
          if (err) {
            console.error('❌ Subscription error:', err);
          }
          setConnectionStatus(status);
        });

      channelRef.current = channel;
    };

    loadMessages();
    if (currentUserId) {
      setupRealtime();
    }

    return () => {
      console.log('🧹 Cleaning up subscription');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [roomId, currentUserId, showRoomEndedAlert]);

  useEffect(() => {
    const pollMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(prevMessages => {
            if (JSON.stringify(prevMessages) !== JSON.stringify(data)) {
              console.log('📊 Messages updated via polling');
              return data;
            }
            return prevMessages;
          });
        } else if (error && isRLSError(error) && !roomEnded) {
          console.log('🚫 RLS error during polling, room may have ended');
          showRoomEndedAlert();
        }
      } catch (error) {
        console.error('Error in pollMessages:', error);
      }
    };

    const interval = setInterval(pollMessages, 2000);
    return () => clearInterval(interval);
  }, [roomId, roomEnded, showRoomEndedAlert]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUserId || roomEnded) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    const optimisticMessage: Message = {
      id: tempId,
      content: messageText,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setIsTyping(false);
    
    try {
      console.log('📤 Sending message:', messageText);
      
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            room_id: roomId,
            sender_id: currentUserId,
            content: messageText,
          }
        ])
        .select()
        .single();

      if (error) {
        if (isRLSError(error)) {
          console.log('🚫 RLS error detected, showing graceful alert');
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setNewMessage('');
          showRoomEndedAlert();
          return;
        }
        
        console.log('Trying sendMessage function...');
        await sendMessage(roomId, currentUserId, messageText);
      } else {
        console.log('✅ Message inserted directly:', data);
      }

      setMessages(prev => prev.filter(m => m.id !== tempId));
      Keyboard.dismiss();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      if (isRLSError(error)) {
        console.log('🚫 RLS error in catch block, showing graceful alert');
        setNewMessage('');
        showRoomEndedAlert();
      } else {
        setNewMessage(messageText);
        Alert.alert(
          'Bruh Moment',
          'Message failed to send. Try again?',
          [{ text: 'Bet' }]
        );
      }
    }
  }, [newMessage, currentUserId, roomId, roomEnded, showRoomEndedAlert]);

  const handleLeaveChat = useCallback(async () => {
    Alert.alert(
      'Peace Out? ✌️',
      'You really wanna dip from this convo?',
      [
        { text: 'Nah Stay', style: 'cancel' },
        {
          text: 'Yeah Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveRoom(roomId);
              await supabase.auth.signOut();
              navigation.navigate('Onboarding');
            } catch (error) {
              console.error('Error leaving chat:', error);
              navigation.navigate('Onboarding');
            }
          },
        },
      ]
    );
  }, [roomId, navigation]);

  // Memoized render function
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    return (
      <MessageItem 
        item={item} 
        index={index} 
        currentUserId={currentUserId} 
        moodColors={moodColors}
        typingAnimValue={typingAnim}
      />
    );
  }, [currentUserId, moodColors]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: Message) => item.id, []);

  const bgRotationInterpolate = bgRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Animated gradient background */}
        <Animated.View style={{
          position: 'absolute',
          width: width * 2,
          height: height * 2,
          left: -width / 2,
          top: -height / 2,
          transform: [{ rotate: bgRotationInterpolate }],
          opacity: 0.1,
        }}>
          <View style={{
            flex: 1,
            backgroundColor: moodColors.gradient[0],
          }} />
          <View style={{
            position: 'absolute',
            top: '30%',
            left: '30%',
            width: '40%',
            height: '40%',
            backgroundColor: moodColors.gradient[1],
            borderRadius: 9999,
            opacity: 0.8,
          }} />
        </Animated.View>

        <Animated.View style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {/* Redesigned Header */}
          <View style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#1A1A1A',
            backgroundColor: '#0A0A0A',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                }}>
                  <Animated.Text style={{
                    fontSize: 32,
                    transform: [{ scale: borderPulse }],
                  }}>
                    {moodEmoji}
                  </Animated.Text>
                  <View>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '800',
                      color: '#FFFFFF',
                      letterSpacing: -0.5,
                    }}>
                      Mystery Chat
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: moodColors.primary,
                      textTransform: 'lowercase',
                    }}>
                      Vibing On {mood}
                    </Text>
                  </View>
                </View>
                
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}>
                  <Animated.View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: (connectionStatus === 'SUBSCRIBED' && !roomEnded) ? '#00FF88' : '#FF3B81',
                    transform: [{ scale: pulseAnim }],
                  }} />
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#888',
                    textTransform: 'lowercase',
                  }}>
                    {roomEnded ? 'rip session 💀' : connectionStatus === 'SUBSCRIBED' ? 'u\'re connected fr' : 'connecting...'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={{
                  backgroundColor: '#1A1A1A',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: moodColors.primary,
                }}
                onPress={handleLeaveChat}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: moodColors.primary,
                  textTransform: 'lowercase',
                }}>
                  dip ✌️
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Session Ended Banner */}
          {(!isConnected || roomEnded) && (
            <Animated.View style={{
              backgroundColor: '#FF1744',
              paddingVertical: 14,
              alignItems: 'center',
              opacity: fadeAnim,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '800',
                color: '#FFFFFF',
                textTransform: 'lowercase',
              }}>
                {roomEnded ? '💀 chat died' : '⚠️ they ghosted you'}
              </Text>
            </Animated.View>
          )}

          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={isUserLoaded ? messages : []}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingVertical: 16,
                paddingBottom: 24,
              }}
              showsVerticalScrollIndicator={false}
              onLayout={() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              }}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
              initialNumToRender={20}
            />

            {/* Enhanced Input */}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              paddingBottom: Platform.OS === 'ios' ? 24 : 16,
              backgroundColor: '#0A0A0A',
              borderTopWidth: 1,
              borderTopColor: '#1A1A1A',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 12,
              }}>
                <View style={{
                  flex: 1,
                  backgroundColor: '#1A1A1A',
                  borderRadius: 24,
                  borderWidth: 2,
                  borderColor: isTyping ? moodColors.primary : '#2A2A2A',
                  overflow: 'hidden',
                }}>
                  <TextInput
                    style={{
                      fontSize: 16,
                      color: '#FFFFFF',
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      maxHeight: 120,
                      fontWeight: '500',
                    }}
                    value={newMessage}
                    onChangeText={handleTextChange}
                    placeholder={roomEnded ? "chat's dead..." : "type sum..."}
                    placeholderTextColor="#555"
                    multiline
                    editable={isConnected && !roomEnded}
                    returnKeyType="send"
                    onSubmitEditing={handleSendMessage}
                    blurOnSubmit={false}
                  />
                  {isTyping && !roomEnded && (
                    <Animated.View style={{
                      position: 'absolute',
                      right: 16,
                      bottom: 16,
                      opacity: typingAnim,
                    }}>
                      <Text style={{ fontSize: 18 }}>✍️</Text>
                    </Animated.View>
                  )}
                </View>
                
                <Animated.View style={{
                  transform: [{ scale: isTyping && !roomEnded ? borderPulse : 1 }],
                }}>
                  <TouchableOpacity
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      backgroundColor: (!isConnected || !isTyping || roomEnded) 
                        ? '#2A2A2A' 
                        : moodColors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: moodColors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isTyping ? 0.5 : 0,
                      shadowRadius: 12,
                      elevation: isTyping ? 8 : 0,
                    }}
                    onPress={handleSendMessage}
                    disabled={!isConnected || !isTyping || roomEnded}
                  >
                    <Text style={{ fontSize: 24 }}>
                      {isTyping && !roomEnded ? '⚡' : '💬'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </SafeAreaView>
    </>
  );
};

export default Chat;