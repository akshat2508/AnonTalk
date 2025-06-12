import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const Chat: React.FC<Props> = ({ navigation, route }) => {
  const { roomId, mood } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isUserLoaded, setIsUserLoaded] = useState(false); // ADD THIS LINE

  const [isConnected, setIsConnected] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerShineAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Entrance animations
  useEffect(() => {
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

    // Header shine effect
    Animated.loop(
      Animated.timing(headerShineAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    ).start();

    // Connection pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, headerShineAnim, pulseAnim]);

  // Typing animation
  useEffect(() => {
    if (newMessage.trim()) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [newMessage, typingAnim]);

  // Auto-scroll effect
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
        setIsUserLoaded(true); // ADD THIS LINE
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
  }, [roomId, currentUserId]);

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
        }
      } catch (error) {
        console.error('Error in pollMessages:', error);
      }
    };

    const interval = setInterval(pollMessages, 2000);
    return () => clearInterval(interval);
  }, [roomId]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUserId) return;

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
        console.error('❌ Direct insert failed, trying sendMessage function:', error);
        await sendMessage(roomId, currentUserId, messageText);
      } else {
        console.log('✅ Message inserted directly:', data);
      }

      setMessages(prev => prev.filter(m => m.id !== tempId));
      Keyboard.dismiss();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
    }
  }, [newMessage, currentUserId, roomId]);

  const handleLeaveChat = useCallback(async () => {
    Alert.alert(
      'Leave Chat',
      'Are you sure you want to leave this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveRoom(roomId);
              await supabase.auth.signOut();
              navigation.navigate('Onboarding');
            } catch (error) {
              console.error('Error leaving chat:', error);
            }
          },
        },
      ]
    );
  }, [roomId, navigation]);

  const getMoodEmoji = useCallback((mood: string): string => {
    const moodEmojis: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      excited: '🤩',
      calm: '😌',
      anxious: '😰',
      default: '💭',
    };
    return moodEmojis[mood.toLowerCase()] || moodEmojis.default;
  }, []);

  const getMoodColors = useCallback((mood: string) => {
    const colors: Record<string, { primary: string; secondary: string; accent: string }> = {
      happy: { primary: '#FFD700', secondary: '#FFA500', accent: '#FF8C00' },
      sad: { primary: '#4682B4', secondary: '#5F9EA0', accent: '#6495ED' },
      excited: { primary: '#FF6347', secondary: '#FF4500', accent: '#FF69B4' },
      calm: { primary: '#32CD32', secondary: '#90EE90', accent: '#98FB98' },
      anxious: { primary: '#9932CC', secondary: '#BA55D3', accent: '#DA70D6' },
      default: { primary: '#007AFF', secondary: '#0056CC', accent: '#4A90E2' },
    };
    return colors[mood.toLowerCase()] || colors.default;
  }, []);

  const moodColors = getMoodColors(mood);
  const moodEmoji = getMoodEmoji(mood);

const MessageItem: React.FC<{ item: Message; index: number; currentUserId: string }> = ({ item, index, currentUserId }) => {
      const isMyMessage = item.sender_id === currentUserId;
    const isOptimistic = item.id.startsWith('temp-');
    
    const messageAnim = useRef(new Animated.Value(0)).current;
    const messageSlide = useRef(new Animated.Value(isMyMessage ? 50 : -50)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(messageAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.timing(messageSlide, {
          toValue: 0,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, [index, messageAnim, messageSlide]);
    
    return (
      <Animated.View
        style={[
          styles.messageWrapper,
          {
            opacity: messageAnim,
            transform: [{ translateX: messageSlide }],
          },
        ]}
      >
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessage : styles.otherMessage,
            isOptimistic && styles.optimisticMessage,
            isMyMessage && { backgroundColor: moodColors.primary },
          ]}
        >
          {/* Message glow effect */}
          <View style={[
            styles.messageGlow,
            isMyMessage 
              ? { backgroundColor: moodColors.primary + '30' }
              : { backgroundColor: '#FFFFFF15' }
          ]} />
          
          <Text style={[
            styles.messageText,
            isMyMessage && { color: '#FFFFFF' }
          ]}>
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.timestamp,
              isMyMessage && { color: 'rgba(255, 255, 255, 0.8)' }
            ]}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            {isOptimistic && (
              <Animated.Text 
                style={[
                  styles.loadingIndicator,
                  { opacity: typingAnim }
                ]}
              >
                ⏳
              </Animated.Text>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
  return <MessageItem item={item} index={index} currentUserId={currentUserId} />;
}, [currentUserId]);

  const headerShine = headerShineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-100%', '100%'],
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.container}>
        {/* Animated background pattern */}
        <View style={styles.backgroundPattern}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.backgroundDot,
                {
                  left: (i % 5) * (width / 5),
                  top: Math.floor(i / 5) * (height / 4),
                  opacity: 0.1,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Enhanced Header */}
          <View style={styles.header}>
            <View style={styles.headerBackground}>
              <Animated.View 
                style={[
                  styles.headerShine,
                  { left: headerShine }
                ]}
              />
            </View>
            
            <View style={styles.headerContent}>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>✨ Anonymous Chat</Text>
                <Animated.View 
                  style={[
                    styles.connectionIndicator,
                    {
                      backgroundColor: connectionStatus === 'SUBSCRIBED' ? '#00FF88' : '#FF6B6B',
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />
              </View>
              <View style={styles.moodRow}>
                <Text style={styles.moodEmoji}>{moodEmoji}</Text>
                <Text style={styles.headerSubtitle}>
                  {mood} • {connectionStatus === 'SUBSCRIBED' ? 'Connected' : 'Connecting...'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.leaveButton, { borderColor: moodColors.accent }]} 
              onPress={handleLeaveChat}
            >
              <Text style={styles.leaveButtonText}>Leave</Text>
            </TouchableOpacity>
          </View>

          {/* Disconnected Banner */}
          {!isConnected && (
            <Animated.View style={[styles.disconnectedBanner, { opacity: fadeAnim }]}>
              <Text style={styles.disconnectedText}>⚠️ Partner disconnected</Text>
              <View style={styles.disconnectedPulse} />
            </Animated.View>
          )}

          <KeyboardAvoidingView 
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={isUserLoaded ? messages : []}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              onLayout={() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              }}
            />

            {/* Enhanced Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputBackground}>
                <View style={styles.inputGlow} />
              </View>
              
              <View style={styles.inputWrapper}>
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#888"
                    multiline
                    editable={isConnected}
                    returnKeyType="send"
                    onSubmitEditing={handleSendMessage}
                    blurOnSubmit={false}
                  />
                  {newMessage.trim() && (
                    <Animated.View 
                      style={[
                        styles.typingIndicator,
                        { opacity: typingAnim }
                      ]}
                    >
                      <Text style={styles.typingDots}>💬</Text>
                    </Animated.View>
                  )}
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    { backgroundColor: moodColors.primary },
                    (!isConnected || !newMessage.trim()) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!isConnected || !newMessage.trim()}
                >
                  <Text style={styles.sendButtonText}>🚀</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </SafeAreaView>
    </>
  );
};


export default Chat;