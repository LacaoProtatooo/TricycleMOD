import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing } from '../common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';

const DEFAULT_BACKEND = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';

const ForumBoard = ({
  token: externalToken,
  backendUrl = DEFAULT_BACKEND,
  placeholder = 'Share an update with everyone...',
  composerLabel = 'Post',
  showHeader = false,
}) => {
  const db = useAsyncSQLiteContext();
  const [internalToken, setInternalToken] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const token = externalToken || internalToken;
  const composerDisabled = !token;

  const initialsFor = useCallback((author) => {
    if (!author) return '?';
    const first = author.firstname?.[0] || '';
    const last = author.lastname?.[0] || '';
    return `${first}${last}`.trim().toUpperCase() || '?';
  }, []);

  useEffect(() => {
    const loadToken = async () => {
      if (externalToken || !db) return;
      try {
        const storedToken = await getToken(db);
        setInternalToken(storedToken);
      } catch (err) {
        console.error('Forum token error:', err);
        setError('Unable to read auth token');
      }
    };

    loadToken();
  }, [db, externalToken]);

  const fetchPosts = useCallback(async (opts = {}) => {
    if (!token) return;
    const isRefresh = opts.isRefresh === true;

    if (isRefresh) {
      setRefreshing(true);
    } else if (!opts.silent) {
      setLoading(true);
    }

    try {
      const res = await fetch(`${backendUrl}/api/forum`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load forum posts');
      }

      setPosts(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Fetch forum posts error:', err);
      setError(err.message || 'Unable to load posts');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else if (!opts.silent) {
        setLoading(false);
      }
    }
  }, [backendUrl, token]);

  useEffect(() => {
    if (token) {
      fetchPosts({ silent: false });
    }
  }, [token, fetchPosts]);

  const handlePost = async () => {
    const trimmed = newPost.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please write something before posting.');
      return;
    }

    if (!token) {
      Alert.alert('Not Authenticated', 'Please login again.');
      return;
    }

    setPosting(true);
    try {
      const res = await fetch(`${backendUrl}/api/forum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit post');
      }

      setPosts((prev) => [data.data, ...prev]);
      setNewPost('');
    } catch (err) {
      console.error('Create forum post error:', err);
      Alert.alert('Error', err.message || 'Unable to submit post.');
    } finally {
      setPosting(false);
    }
  };

  const postAvatar = useCallback((author) => {
    if (author?.image?.url) {
      return <Image source={{ uri: author.image.url }} style={styles.avatarImage} />;
    }
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarText}>{initialsFor(author)}</Text>
      </View>
    );
  }, [initialsFor]);

  const renderItem = ({ item }) => {
    const author = item.author || {};
    const authorName = `${author.firstname || ''} ${author.lastname || ''}`.trim() || 'Unknown user';
    const roleLabel = (author.role || 'driver').toUpperCase();
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          {postAvatar(author)}
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.postMeta}>
              {roleLabel} • {createdAt.toLocaleString()}
            </Text>
          </View>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
      </View>
    );
  };

  if (!token && loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {showHeader && (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Forum</Text>
          <TouchableOpacity onPress={() => fetchPosts({ silent: true })}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={[styles.textInput, composerDisabled && styles.textInputDisabled]}
          placeholder={placeholder}
          placeholderTextColor="#888"
          multiline
          value={newPost}
          onChangeText={setNewPost}
          editable={!composerDisabled}
        />
        <TouchableOpacity
          style={[
            styles.postButton,
            (posting || !newPost.trim() || composerDisabled) && styles.postButtonDisabled,
          ]}
          onPress={handlePost}
          disabled={posting || !newPost.trim() || composerDisabled}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postButtonText}>{composerLabel}</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => fetchPosts({ silent: false })}>
          <Text style={styles.errorText}>{error} • Tap to retry</Text>
        </TouchableOpacity>
      )}

      {loading && posts.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts({ isRefresh: true })} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.orangeShade5} />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>Start the conversation above.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  composer: {
    marginHorizontal: spacing.medium,
    marginBottom: spacing.small,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  textInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#333',
  },
  textInputDisabled: {
    backgroundColor: colors.ivory2,
    color: '#777',
  },
  postButton: {
    marginTop: spacing.small,
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.large,
    paddingVertical: 10,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorBanner: {
    marginHorizontal: spacing.medium,
    marginBottom: spacing.small,
    padding: spacing.small,
    borderRadius: 8,
    backgroundColor: '#fdecea',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.large,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.medium,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.medium,
    backgroundColor: colors.ivory2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: colors.primary,
  },
  authorName: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.orangeShade8,
  },
  postMeta: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.large,
  },
  emptyTitle: {
    marginTop: spacing.small,
    fontWeight: '600',
    color: colors.primary,
  },
  emptySubtitle: {
    color: colors.orangeShade5,
    marginTop: 4,
  },
});

export default ForumBoard;
