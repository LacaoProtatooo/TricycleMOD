import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  Animated,
  Keyboard,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { useSelector } from 'react-redux';
import { API_URL } from '../../utils/config';

const DEFAULT_BACKEND = API_URL;
const MAX_CHARS = 2000;

// Helper function for relative time
const getRelativeTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(date).toLocaleDateString();
};

// Role badge component
const RoleBadge = ({ role }) => {
  const getRoleStyle = () => {
    switch (role?.toLowerCase()) {
      case 'operator':
        return { bg: '#8B5CF6', text: 'Operator' };
      case 'driver':
        return { bg: '#3B82F6', text: 'Driver' };
      case 'admin':
        return { bg: '#EF4444', text: 'Admin' };
      default:
        return { bg: '#6B7280', text: role || 'User' };
    }
  };
  const style = getRoleStyle();
  return (
    <View style={[styles.roleBadge, { backgroundColor: style.bg }]}>
      <Text style={styles.roleBadgeText}>{style.text}</Text>
    </View>
  );
};

const ForumBoard = ({
  token: externalToken,
  backendUrl = DEFAULT_BACKEND,
  placeholder = 'Share an update with everyone...',
  composerLabel = 'Post',
  showHeader = false,
}) => {
  const db = useAsyncSQLiteContext();
  const currentUser = useSelector((state) => state.user?.currentUser || state.auth?.user);
  const [internalToken, setInternalToken] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  
  // Comment states
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentingPostId, setCommentingPostId] = useState(null);

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

    Keyboard.dismiss();
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

  // Toggle like on a post
  const handleLike = async (postId) => {
    if (!token) return;

    // Optimistic update
    setPosts(prev => prev.map(post => {
      if (post._id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likeCount: isLiked ? (post.likeCount || 0) + 1 : Math.max(0, (post.likeCount || 1) - 1),
        };
      }
      return post;
    }));

    try {
      const res = await fetch(`${backendUrl}/api/forum/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert on error
        fetchPosts({ silent: true });
      }
    } catch (err) {
      console.error('Like error:', err);
      fetchPosts({ silent: true });
    }
  };

  // Add comment to a post
  const handleComment = async (postId) => {
    const content = commentInputs[postId]?.trim();
    if (!content || !token) return;

    setCommentingPostId(postId);
    try {
      const res = await fetch(`${backendUrl}/api/forum/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to add comment');
      }

      // Update posts with new comment
      setPosts(prev => prev.map(post => {
        if (post._id === postId) {
          return {
            ...post,
            comments: [...(post.comments || []), data.data],
            commentCount: data.commentCount,
          };
        }
        return post;
      }));

      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      Keyboard.dismiss();
    } catch (err) {
      console.error('Comment error:', err);
      Alert.alert('Error', err.message || 'Unable to add comment.');
    } finally {
      setCommentingPostId(null);
    }
  };

  // Delete post
  const handleDeletePost = (postId) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${backendUrl}/api/forum/${postId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to delete post');
              }

              setPosts(prev => prev.filter(p => p._id !== postId));
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert('Error', err.message || 'Unable to delete post.');
            }
          },
        },
      ]
    );
  };

  // Delete comment
  const handleDeleteComment = (postId, commentId) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${backendUrl}/api/forum/${postId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to delete comment');
              }

              setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                  return {
                    ...post,
                    comments: post.comments.filter(c => c._id !== commentId),
                    commentCount: data.commentCount,
                  };
                }
                return post;
              }));
            } catch (err) {
              console.error('Delete comment error:', err);
              Alert.alert('Error', err.message || 'Unable to delete comment.');
            }
          },
        },
      ]
    );
  };

  const postAvatar = useCallback((author, size = 48) => {
    if (author?.image?.url) {
      return <Image source={{ uri: author.image.url }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />;
    }
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initialsFor(author)}</Text>
      </View>
    );
  }, [initialsFor]);

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const renderComment = (comment, postId) => {
    const author = comment.author || {};
    const authorName = `${author.firstname || ''} ${author.lastname || ''}`.trim() || 'Unknown';
    const isOwnComment = currentUser && (currentUser._id === author._id || currentUser.id === author._id);

    return (
      <View key={comment._id} style={styles.commentItem}>
        {postAvatar(author, 32)}
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{authorName}</Text>
            <Text style={styles.commentTime}>{getRelativeTime(comment.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{comment.content}</Text>
        </View>
        {isOwnComment && (
          <TouchableOpacity 
            style={styles.commentDeleteBtn}
            onPress={() => handleDeleteComment(postId, comment._id)}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const author = item.author || {};
    const authorName = `${author.firstname || ''} ${author.lastname || ''}`.trim() || 'Unknown user';
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const isOwnPost = currentUser && (currentUser._id === author._id || currentUser.id === author._id);
    const showComments = expandedComments[item._id];
    const likeCount = item.likeCount || item.likes?.length || 0;
    const commentCount = item.commentCount || item.comments?.length || 0;

    return (
      <View style={[styles.postCard, item.isPinned && styles.pinnedPost]}>
        {item.isPinned && (
          <View style={styles.pinnedBanner}>
            <Ionicons name="pin" size={12} color="#F59E0B" />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}
        
        <View style={styles.postHeader}>
          {postAvatar(author)}
          <View style={{ flex: 1 }}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{authorName}</Text>
              <RoleBadge role={author.role} />
            </View>
            <Text style={styles.postMeta}>{getRelativeTime(createdAt)}</Text>
          </View>
          {isOwnPost && (
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => handleDeletePost(item._id)}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.postContent}>{item.content}</Text>

        {/* Engagement Stats */}
        <View style={styles.engagementRow}>
          <TouchableOpacity 
            style={styles.engagementBtn}
            onPress={() => handleLike(item._id)}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={item.isLiked ? "#EF4444" : colors.orangeShade5} 
            />
            <Text style={[styles.engagementText, item.isLiked && { color: '#EF4444' }]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.engagementBtn}
            onPress={() => toggleComments(item._id)}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.orangeShade5} />
            <Text style={styles.engagementText}>
              {commentCount > 0 ? `${commentCount} Comments` : 'Comment'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {showComments && (
          <View style={styles.commentsSection}>
            {/* Comment input */}
            <View style={styles.commentInputRow}>
              {postAvatar(currentUser, 32)}
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#888"
                value={commentInputs[item._id] || ''}
                onChangeText={(text) => setCommentInputs(prev => ({ ...prev, [item._id]: text }))}
                multiline
              />
              <TouchableOpacity 
                style={[
                  styles.commentSendBtn,
                  (!commentInputs[item._id]?.trim() || commentingPostId === item._id) && styles.commentSendBtnDisabled
                ]}
                onPress={() => handleComment(item._id)}
                disabled={!commentInputs[item._id]?.trim() || commentingPostId === item._id}
              >
                {commentingPostId === item._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Comments list */}
            {item.comments && item.comments.length > 0 && (
              <View style={styles.commentsList}>
                {item.comments.map(comment => renderComment(comment, item._id))}
              </View>
            )}
          </View>
        )}
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

  const charCount = newPost.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <View style={styles.wrapper}>
      {showHeader && (
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="chatbubbles" size={24} color={colors.primary} />
            <Text style={styles.headerTitle}>Forum</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshBtn}
            onPress={() => fetchPosts({ silent: true })}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <View style={styles.composerHeader}>
          {postAvatar(currentUser, 40)}
          <View style={styles.composerInfo}>
            <Text style={styles.composerName}>
              {currentUser ? `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() : 'You'}
            </Text>
            <Text style={styles.composerHint}>Share with the community</Text>
          </View>
        </View>
        <TextInput
          style={[
            styles.textInput, 
            composerDisabled && styles.textInputDisabled,
            isOverLimit && styles.textInputError
          ]}
          placeholder={placeholder}
          placeholderTextColor="#888"
          multiline
          value={newPost}
          onChangeText={setNewPost}
          editable={!composerDisabled}
        />
        <View style={styles.composerFooter}>
          <Text style={[styles.charCount, isOverLimit && styles.charCountError]}>
            {charCount}/{MAX_CHARS}
          </Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              (posting || !newPost.trim() || composerDisabled || isOverLimit) && styles.postButtonDisabled,
            ]}
            onPress={handlePost}
            disabled={posting || !newPost.trim() || composerDisabled || isOverLimit}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.postButtonText}>{composerLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => fetchPosts({ silent: false })}>
          <Ionicons name="alert-circle" size={18} color="#c62828" />
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
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to start a conversation!</Text>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ivory2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    marginHorizontal: spacing.medium,
    marginVertical: spacing.small,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  composerInfo: {
    marginLeft: spacing.small,
  },
  composerName: {
    fontWeight: '600',
    color: colors.orangeShade7,
    fontSize: 14,
  },
  composerHint: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  textInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.small,
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  textInputDisabled: {
    backgroundColor: colors.ivory2,
    color: '#777',
  },
  textInputError: {
    borderColor: '#EF4444',
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  charCount: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  charCountError: {
    color: '#EF4444',
    fontWeight: '600',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.medium,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.medium,
    marginBottom: spacing.small,
    padding: spacing.small,
    borderRadius: 8,
    backgroundColor: '#fdecea',
    gap: 8,
  },
  errorText: {
    color: '#c62828',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pinnedPost: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.small,
  },
  pinnedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
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
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.orangeShade8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  postMeta: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: spacing.small,
  },
  engagementRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
    paddingTop: spacing.small,
    gap: spacing.medium,
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.ivory1,
    gap: 6,
  },
  engagementText: {
    fontSize: 13,
    color: colors.orangeShade5,
    fontWeight: '500',
  },
  commentsSection: {
    marginTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
    paddingTop: spacing.small,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.ivory1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    color: '#333',
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnDisabled: {
    opacity: 0.5,
  },
  commentsList: {
    marginTop: spacing.small,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.small,
    gap: 8,
  },
  commentContent: {
    flex: 1,
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 13,
    color: colors.orangeShade7,
  },
  commentTime: {
    fontSize: 11,
    color: colors.orangeShade5,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  commentDeleteBtn: {
    padding: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.large * 2,
    padding: spacing.large,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.ivory2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.medium,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.orangeShade5,
    fontSize: 14,
  },
});

export default ForumBoard;
