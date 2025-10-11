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
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { joinOrCreateRoom, Mood } from '../lib/room';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Google Forms Configuration
const GOOGLE_FORMS_CONFIG = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfn0XwLayWhxNEqE6iu5n0V3NCd3DB05bJ9NTGqP53feLH68Q/formResponse',
  fields: {
    rating: 'entry.1440786762',
    feedback: 'entry.1947284111',
    timestamp: 'entry.446406858',
    appName: 'entry.833439770',
  }
};

type OnboardingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const moods: { key: Mood; emoji: string; label: string; colors: readonly [string, string]; gradient: readonly [string, string, string] }[] = [
  { key: 'happy', emoji: '✨', label: 'Vibing', colors: ['#FFD93D', '#FFED4E'] as const, gradient: ['#FEE140', '#FA709A', '#FEE140'] as const },
  { key: 'sad', emoji: '💔', label: 'Down Bad', colors: ['#6BB6FF', '#9DCEFF'] as const, gradient: ['#667EEA', '#764BA2', '#667EEA'] as const },
  { key: 'excited', emoji: '🤤', label: 'Spicy', colors: ['#FF6B6B', '#FF8E8E'] as const, gradient: ['#FF0844', '#FF6B6B', '#FF0844'] as const },
  { key: 'anxious', emoji: '😵‍💫', label: 'Stressed', colors: ['#DDA0DD', '#E6B8E6'] as const, gradient: ['#A8EDEA', '#FED6E3', '#A8EDEA'] as const },
  { key: 'calm', emoji: '🌿', label: 'Chill Fr', colors: ['#98FB98', '#B8FFB8'] as const, gradient: ['#56CCF2', '#2F80ED', '#56CCF2'] as const },
  { key: 'angry', emoji: '😤', label: 'Big Mad', colors: ['#FF4500', '#FF6B2B'] as const, gradient: ['#F85032', '#E73827', '#F85032'] as const },
];

export default function Onboarding({ navigation }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [selectedMood, setSelectedMood] = React.useState<Mood | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);
  const [hasShownPrivacyAlert, setHasShownPrivacyAlert] = React.useState(false);
  
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const moodAnimations = React.useRef(
    moods.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    showPrivacyAlert();
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    const staggerDelay = 80;
    moodAnimations.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: 200 + index * staggerDelay,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    });

    // Continuous pulse animation for title
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Continuous rotation for decorative element
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const showPrivacyAlert = () => {
    if (!hasShownPrivacyAlert) {
      Alert.alert(
        "🔒 Privacy & Safety",
        "Welcome to AnonTalk! For your safety and privacy:\n\n• Never share personal information (name, address, phone, etc.)\n• Don't reveal your location\n• Keep conversations anonymous\n• Report inappropriate behavior\n• Trust your instincts\n\n🛡️ Auto-Cleaning Messages: \nTo enhance privacy and app performance, messages older than 5 minutes will be automatically deleted every 15 minutes. This ensures a clutter-free, secure chat experience for all users.\n\nStay safe and enjoy connecting! 💙",
        [
          {
            text: "I Understand",
            style: "default",
            onPress: () => setHasShownPrivacyAlert(true)
          }
        ],
        { cancelable: false }
      );
    }
  };

  const submitToGoogleForms = async (feedback: string, userRating: number): Promise<boolean> => {
    try {
      console.log('Submitting feedback to Google Forms...', { rating: userRating, feedback });

      const formData = new FormData();
      formData.append(GOOGLE_FORMS_CONFIG.fields.rating, userRating.toString());
      formData.append(GOOGLE_FORMS_CONFIG.fields.feedback, feedback);
      
      if (GOOGLE_FORMS_CONFIG.fields.timestamp) {
        formData.append(GOOGLE_FORMS_CONFIG.fields.timestamp, new Date().toLocaleString());
      }
      
      if (GOOGLE_FORMS_CONFIG.fields.appName) {
        formData.append(GOOGLE_FORMS_CONFIG.fields.appName, 'AnonTalk');
      }

      const response = await fetch(GOOGLE_FORMS_CONFIG.formUrl, {
        method: 'POST',
        body: formData,
        mode: 'no-cors',
      });

      console.log('Feedback submitted to Google Forms successfully');
      return true;

    } catch (error) {
      console.error('Error submitting to Google Forms:', error);
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        
        if (error.message.includes('Network request failed')) {
          console.error('Network error - Check internet connection');
        }
      }
      
      return false;
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || rating === 0) {
      Alert.alert('Incomplete Feedback', 'Please provide both a rating and feedback text.');
      return;
    }

    setSubmittingFeedback(true);
    
    try {
      console.log('Submitting feedback:', { rating, feedback: feedbackText });
      
      const success = await submitToGoogleForms(feedbackText, rating);
      
      if (success) {
        Alert.alert(
          'Thank You! 🙏',
          'Your feedback has been submitted successfully. We appreciate your input!',
          [{ 
            text: 'OK', 
            onPress: () => {
              setShowFeedbackModal(false);
              setFeedbackText('');
              setRating(0);
            }
          }]
        );
      } else {
        Alert.alert(
          'Error Submitting Feedback',
          'We couldn\'t submit your feedback right now. Please check your internet connection and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => handleSubmitFeedback() }
          ]
        );
      }
    } catch (error) {
      console.error('Unexpected error in handleSubmitFeedback:', error);
      Alert.alert(
        'Unexpected Error',
        'Something went wrong while submitting your feedback. Please try again later.'
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleCloseFeedbackModal = () => {
    if (submittingFeedback) {
      Alert.alert(
        'Submitting Feedback',
        'Your feedback is still being submitted. Are you sure you want to close?',
        [
          { text: 'Keep Open', style: 'cancel' },
          { 
            text: 'Close Anyway', 
            style: 'destructive',
            onPress: () => {
              setShowFeedbackModal(false);
              setFeedbackText('');
              setRating(0);
            }
          }
        ]
      );
      return;
    }
    
    setShowFeedbackModal(false);
    setFeedbackText('');
    setRating(0);
  };

  const handleMoodSelection = async (mood: Mood) => {
    if (loading) return;
    
    setLoading(true);
    setSelectedMood(mood);
    
    const moodIndex = moods.findIndex(m => m.key === mood);
    Animated.sequence([
      Animated.timing(moodAnimations[moodIndex], {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(moodAnimations[moodIndex], {
        toValue: 1,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      console.log(`Selected mood: ${mood}`);
      
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

      await new Promise(resolve => setTimeout(resolve, 500));

      const room = await joinOrCreateRoom(mood, userId);
      
      console.log('Room result:', room);
      
      if (room.status === 'active') {
        console.log('Navigating to Chat - room is active');
        navigation.replace('Chat', { roomId: room.id, mood });
      } else {
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

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Text style={[
              styles.star,
              star <= rating ? styles.starFilled : styles.starEmpty
            ]}>
              ⭐
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0F', '#1A0F2E', '#2D1B3D']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Animated Background Elements */}
          <Animated.View style={[styles.bgCircle1, { transform: [{ rotate: spin }] }]} />
          <Animated.View style={[styles.bgCircle2, { transform: [{ rotate: spin }] }]} />
          
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
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => setShowFeedbackModal(true)}
              >
                <LinearGradient
                  colors={['#FF0844', '#FFB199']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.feedbackGradient}
                >
                  <Text style={styles.feedbackButtonText}>💬 Spill Tea</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={styles.title}>AnonTalk</Text>
                <View style={styles.titleAccent}>
                  <LinearGradient
                    colors={['#FF0844', '#FF6B6B', '#FFB199']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentBar}
                  />
                </View>
              </Animated.View>
              
              <Text style={styles.subtitle}>What's the vibe rn? 👀</Text>
              <Text style={styles.description}>
                Find ur ppl. No Cap 💯
              </Text>
            </View>
            
            {/* Mood Grid - Vertical Scroll Layout */}
            <ScrollView 
              style={styles.moodScrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.moodScrollContent}
            >
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
                            translateX: moodAnimations[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [index % 2 === 0 ? -100 : 100, 0],
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
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={mood.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.moodGradient}
                      >
                        <BlurView intensity={10} style={styles.moodBlur}>
                          <View style={styles.moodContent}>
                            <View style={styles.emojiContainer}>
                              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                            </View>
                            <Text style={styles.moodLabel}>
                              {loading && selectedMood === mood.key ? 'loading...' : mood.label}
                            </Text>
                            {loading && selectedMood === mood.key && (
                              <View style={styles.loadingDots}>
                                <View style={[styles.dot, styles.dot1]} />
                                <View style={[styles.dot, styles.dot2]} />
                                <View style={[styles.dot, styles.dot3]} />
                              </View>
                            )}
                          </View>
                        </BlurView>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </ScrollView>

            {/* Footer Indicator */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Tap Ur Mood ⚡</Text>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseFeedbackModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={['#1A0F2E', '#2D1B3D']}
              style={styles.modalContent}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Spill The Tea ☕</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleCloseFeedbackModal}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.ratingLabel}>Rate The Vibe Fr</Text>
                {renderStars()}

                <Text style={styles.feedbackLabel}>Tell Us Everything Bestie:</Text>
                <TextInput
                  style={styles.feedbackInput}
                  multiline
                  numberOfLines={6}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="No Filter Zone... Be Honest 💯"
                  placeholderTextColor="#8B7BA8"
                  textAlignVertical="top"
                />

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (!feedbackText.trim() || rating === 0 || submittingFeedback) && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmitFeedback}
                    disabled={!feedbackText.trim() || rating === 0 || submittingFeedback}
                  >
                    <LinearGradient
                      colors={(!feedbackText.trim() || rating === 0 || submittingFeedback) ? ['#6B5B7B', '#4A3C5A'] : ['#FF0844', '#FF6B6B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      <Text style={styles.submitButtonText}>
                        {submittingFeedback ? 'sending...' : 'send it 🚀'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeModalButton}
                    onPress={handleCloseFeedbackModal}
                  >
                    <Text style={styles.closeModalButtonText}>nvm</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bgCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 8, 68, 0.1)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(107, 92, 231, 0.1)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flex: 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  feedbackButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#FF0844',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  feedbackGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  feedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -2,
    textShadowColor: 'rgba(255, 8, 68, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
    marginTop: 10
  },
  titleAccent: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  accentBar: {
    width: 120,
    height: 6,
    borderRadius: 3,
  },
  subtitle: {
    fontSize: 20,
    color: '#E8DCFF',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    color: '#A99BC7',
    textAlign: 'center',
    fontWeight: '600',
  },
  moodScrollContainer: {
    flex: 1,
    marginTop: 10,
  },
  moodScrollContent: {
    paddingBottom: 20,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodButtonContainer: {
    width: '48%',
    marginBottom: 14,
  },
  moodButton: {
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  moodGradient: {
    padding: 3,
  },
  moodBlur: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  moodContent: {
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    borderRadius: 25,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  selectedMood: {
    transform: [{ scale: 0.92 }],
  },
  emojiContainer: {
    marginBottom: 10,
  },
  moodEmoji: {
    fontSize: 48,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0844',
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    color: '#8B7BA8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 30,
    padding: 28,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#FF0844',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#E8DCFF',
    fontWeight: '700',
  },
  ratingLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E8DCFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 10,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 34,
  },
  starFilled: {
    opacity: 1,
  },
  starEmpty: {
    opacity: 0.25,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8DCFF',
    marginBottom: 12,
  },
  feedbackInput: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 18,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
    minHeight: 130,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 12,
  },
  submitButton: {
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeModalButton: {
    backgroundColor: 'rgba(255, 251, 251, 1)',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeModalButtonText: {
    color: '#a99bc7',
    fontSize: 17,
    fontWeight: '700',
  },
});