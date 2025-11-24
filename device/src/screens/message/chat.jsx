// chat.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Constants from 'expo-constants';
import axios from 'axios';
import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';

const apiURL = Constants.expoConfig.extra?.BACKEND_URL || 'http://192.168.254.112:5000';

const Chat = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const db = useAsyncSQLiteContext();
  const currentUser = useSelector((state) => state.auth.user);
  const flatListRef = useRef(null);

  const { userId, userName, userImage } = route.params;

  const [token, setToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 1️⃣ Load token ONCE when component mounts
  useEffect(() => {
    const loadAuth = async () => {
      if (!db) return;

      const storedToken = await getToken(db);
      
      if (!storedToken) {
        Alert.alert("Session Expired", "Please login again");
        navigation.replace("Login");
        return;
      }

      setToken(storedToken);
    };

    loadAuth();
  }, [db]);

  // 2️⃣ Set header with user info
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Image
            source={
              userImage
                ? { uri: userImage }
                : require('../../../assets/ghost.png')
            }
            style={styles.headerAvatar}
          />
          <Text style={styles.headerTitle}>{userName}</Text>
        </View>
      ),
    });
  }, [userName, userImage]);

  // 3️⃣ Load messages when token and userId are ready
  useEffect(() => {
    if (!token || !userId) return;

    loadMessages();
  }, [token, userId]);

  // 4️⃣ Fetch messages safely
  const loadMessages = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${apiURL}/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);

      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        navigation.replace('Login');
      }
    } finally {
      setLoading(false);

      // Auto scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  };

  // 5️⃣ Send message handler
  const sendMessageHandler = async () => {
    if (!messageText.trim()) return;

    const messageToSend = messageText.trim();
    const tempMessage = {
      _id: Date.now().toString(),
      text: messageToSend,
      senderId: { 
        _id: currentUser._id,
        firstname: currentUser.firstname,
        lastname: currentUser.lastname,
        image: currentUser.image,
      },
      receiverId: userId,
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessageText('');

    try {
      setSending(true);

      const response = await axios.post(
        `${apiURL}/api/messages/send`,
        {
          receiverId: userId,
          text: messageToSend,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        // Replace temp message with real message
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id
              ? { ...response.data.message, isSending: false }
              : msg
          )
        );

        // Auto scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        navigation.replace('Login');
      } else {
        Alert.alert('Error', errorMessage);
      }
      
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id));
    } finally {
      setSending(false);
    }
  };

  // 6️⃣ Render message bubble
  const renderMessage = ({ item }) => {
    if (!currentUser) return null;
    
    const isMyMessage = item.senderId?._id === currentUser._id || item.senderId === currentUser._id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        {item.isSending && (
          <ActivityIndicator
            size="small"
            color={colors.orangeShade4}
            style={styles.sendingIndicator}
          />
        )}
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.orangeShade3}
              />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessageHandler}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: colors.ivory3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  messagesList: {
    padding: spacing.medium,
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: colors.orangeShade4,
  },
  sendingIndicator: {
    marginLeft: 8,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.medium,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
    alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? spacing.large : spacing.medium,
  },
  input: {
    flex: 1,
    backgroundColor: colors.ivory2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: spacing.small,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginTop: spacing.medium,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.orangeShade4,
    marginTop: spacing.small,
  },
});

export default Chat;