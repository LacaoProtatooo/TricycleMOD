// chatMenu.jsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Constants from 'expo-constants';
import axios from 'axios';

import { colors, spacing } from "../../components/common/theme";
import { useAsyncSQLiteContext } from "../../utils/asyncSQliteProvider";
import { getToken } from "../../utils/jwtStorage";

const apiURL = Constants.expoConfig.extra?.BACKEND_URL;

const ChatMenu = () => {
  const navigation = useNavigation();
  const db = useAsyncSQLiteContext();

  // Get logged-in user only (no authentication guards here)
  const currentUser = useSelector((state) => state.auth.user);

  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserList, setShowUserList] = useState(false);

  // Load conversations whenever the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (db && currentUser) {
        loadConversations();
        loadUsers();
      }
    }, [db, currentUser])
  );

  const loadConversations = async () => {
    if (!db || !currentUser?._id) {
      setLoading(false);
      return;
    }

    try {
      const token = await getToken(db);
      if (!token) return;

      const response = await axios.get(`${apiURL}/api/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!db || !currentUser?._id) return;

    try {
      const token = await getToken(db);
      if (!token) return;

      const response = await axios.get(`${apiURL}/api/messages/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const startNewConversation = (user) => {
    navigation.navigate("Chat", {
      userId: user._id,
      userName: `${user.firstname} ${user.lastname}`,
      userImage: user.image?.url || user.image,
    });

    setShowUserList(false);
    setSearchQuery('');
  };

  const openConversation = (conversation) => {
    const otherUser =
      conversation.participants.find((p) => p._id !== currentUser?._id);

    if (!otherUser) return;

    navigation.navigate("Chat", {
      userId: otherUser._id,
      userName: `${otherUser.firstname} ${otherUser.lastname}`,
      userImage: otherUser.image?.url || otherUser.image,
    });
  };

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstname} ${user.lastname}`.toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const renderConversation = ({ item }) => {
    const otherUser = item.participants.find(
      (p) => p._id !== currentUser?._id
    );
    if (!otherUser) return null;

    const imageUri = otherUser.image?.url || otherUser.image;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => openConversation(item)}
      >
        <Image
          source={
            imageUri ? { uri: imageUri } : require('../../../assets/ghost.png')
          }
          style={styles.avatar}
        />
        <View style={styles.conversationInfo}>
          <Text style={styles.userName}>
            {otherUser.firstname} {otherUser.lastname}
          </Text>
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage.text}
            </Text>
          )}
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderUser = ({ item }) => {
    const imageUri = item.image?.url || item.image;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => startNewConversation(item)}
      >
        <Image
          source={
            imageUri ? { uri: imageUri } : require('../../../assets/ghost.png')
          }
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.firstname} {item.lastname}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowUserList(!showUserList)}
        >
          <Ionicons
            name={showUserList ? "close" : "create-outline"}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showUserList && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.orangeShade5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      )}

      {/* User list or conversations */}
      {showUserList ? (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.orangeShade3}
              />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + icon to start a new chat
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.large,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },
  newChatButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    margin: spacing.medium,
    paddingHorizontal: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#333",
  },
  listContainer: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.medium,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory2,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.medium,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.medium,
  },
  conversationInfo: {
    flex: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.orangeShade5,
  },
  userEmail: {
    fontSize: 14,
    color: colors.orangeShade5,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  unreadText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.orangeShade5,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 6,
    color: colors.orangeShade4,
  },
});

export default ChatMenu;
