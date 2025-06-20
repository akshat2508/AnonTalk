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
  // Replace with your Google Form URL (the one you get when you click "Send" -> "Link")
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfn0XwLayWhxNEqE6iu5n0V3NCd3DB05bJ9NTGqP53feLH68Q/formResponse',
  // Replace with your form field entry IDs (inspect the form HTML to get these)
  fields: {
    rating: 'entry.1440786762',    // Replace with your rating field entry ID
    feedback: 'entry.1947284111',  // Replace with your feedback field entry ID
    timestamp: 'entry.446406858', // Replace with your timestamp field entry ID (optional)
    appName: 'entry.833439770',   // Replace with your app name field entry ID (optional)
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
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);
  const [hasShownPrivacyAlert, setHasShownPrivacyAlert] = React.useState(false);
  
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const moodAnimations = React.useRef(
    moods.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    // Show privacy alert when component mounts
    showPrivacyAlert();
    
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

  const showPrivacyAlert = () => {
    if (!hasShownPrivacyAlert) {
      Alert.alert(
        "🔒 Privacy & Safety",
        "Welcome to AnonTalk! For your safety and privacy:\n\n• Never share personal information (name, address, phone, etc.)\n• Don't reveal your location\n• Keep conversations anonymous\n• Report inappropriate behavior\n• Trust your instincts\n\n🛡️ Auto-Cleaning Messages: \nTo enhance privacy and app performance, messages older than 5 minutes will  be automatically deleted every 15 minutes. This ensures a clutter-free, secure chat experience for all users.\n\nStay safe and enjoy connecting! 💙",
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

      // Create form data
      const formData = new FormData();
      formData.append(GOOGLE_FORMS_CONFIG.fields.rating, userRating.toString());
      formData.append(GOOGLE_FORMS_CONFIG.fields.feedback, feedback);
      
      // Optional: Add timestamp and app name if you have those fields in your form
      if (GOOGLE_FORMS_CONFIG.fields.timestamp) {
        formData.append(GOOGLE_FORMS_CONFIG.fields.timestamp, new Date().toLocaleString());
      }
      
      if (GOOGLE_FORMS_CONFIG.fields.appName) {
        formData.append(GOOGLE_FORMS_CONFIG.fields.appName, 'AnonTalk');
      }

      // Submit to Google Forms
      const response = await fetch(GOOGLE_FORMS_CONFIG.formUrl, {
        method: 'POST',
        body: formData,
        mode: 'no-cors', // Important: Google Forms requires no-cors mode
      });

      // Note: With no-cors mode, we can't read the response status
      // Google Forms will always appear to succeed from the client side
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
    // If feedback is still being submitted, warn the user
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
              <View style={styles.headerTop}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => setShowFeedbackModal(true)}
                >
                  <Text style={styles.feedbackButtonText}>💬 Feedback</Text>
                </TouchableOpacity>
              </View>
              
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
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Share Your Feedback 💭</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleCloseFeedbackModal}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.ratingLabel}>How would you rate your experience?</Text>
                {renderStars()}

                <Text style={styles.feedbackLabel}>Tell us more about your experience:</Text>
                <TextInput
                  style={styles.feedbackInput}
                  multiline
                  numberOfLines={6}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Share your thoughts, suggestions, or report any issues..."
                  placeholderTextColor="#94A3B8"
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
                    <Text style={styles.submitButtonText}>
                      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeModalButton}
                    onPress={handleCloseFeedbackModal}
                  >
                    <Text style={styles.closeModalButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
   backgroundColor: '#0F0F23', // Add this line

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
  headerTop: {
    position: 'absolute',
    top: 10,
    right: 0,
    zIndex: 1,
  },
  feedbackButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  feedbackButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(20, 4, 98, 0.3)',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 23, 90, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#4A5568',
    fontWeight: '600',
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 32,
  },
  starFilled: {
    opacity: 1,
  },
  starEmpty: {
    opacity: 0.3,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3748',
    backgroundColor: '#F7FAFC',
    marginBottom: 24,
    minHeight: 120,
  },
  buttonContainer: {
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E0',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#F7FAFC',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeModalButtonText: {
    color: '#4A5568',
    fontSize: 16,
    fontWeight: '600',
  },
});