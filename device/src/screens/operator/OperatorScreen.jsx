import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from '../../components/common/theme';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { useSelector } from 'react-redux';

const BACKEND = (Constants?.expoConfig?.extra?.BACKEND_URL) || (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.111:5000';
const Tab = createBottomTabNavigator();

export default function OperatorScreen({ navigation }) {
  const db = useAsyncSQLiteContext();
  const user = useSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [tricycles, setTricycles] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  // Driver assignment modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [assigning, setAssigning] = useState(false);

  // Add tricycle modal
  const [addTricycleModalVisible, setAddTricycleModalVisible] = useState(false);
  const [newTricycle, setNewTricycle] = useState({ plateNumber: '', model: '' });
  const [creating, setCreating] = useState(false);

  // messaging states (shared with Overview)
  const [messages, setMessages] = useState({});
  const [msgModalVisible, setMsgModalVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // forums (local fallback)
  const [threads, setThreads] = useState([]);
  const [newThreadText, setNewThreadText] = useState('');
  const [posting, setPosting] = useState(false);

  // Load token and fetch data
  useEffect(() => {
    if (db) {
      loadTokenAndFetchData();
    }
  }, [db]);

  const loadTokenAndFetchData = async () => {
    try {
      if (db) {
        const authToken = await getToken(db);
        setToken(authToken);
        if (authToken) {
          await fetchOperatorData(authToken);
        } else {
          setError('No authentication token found. Please login.');
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading token:', error);
      setError('Failed to load authentication token');
      setLoading(false);
    }
  };

  const fetchOperatorData = async (authToken) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND}/api/operator/overview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        setTricycles(data.tricycles || []);
        setDrivers(data.allDrivers || data.drivers || []);
        setAvailableDrivers(data.availableDrivers || []);
      } else {
        throw new Error(data.message || 'Failed to fetch data');
      }
    } catch (e) {
      console.error('Error fetching operator data:', e);
      setError(e.message || 'Failed to fetch operator data');
      // Don't show mock data on error - just show error message
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (token) {
      await fetchOperatorData(token);
    } else if (db) {
      await loadTokenAndFetchData();
    }
  };

  // Assign driver to tricycle
  const handleAssignDriver = async (tricycleId, driverId) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch(`${BACKEND}/api/operator/assign-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tricycleId, driverId }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Driver assigned successfully');
        setAssignModalVisible(false);
        await fetchOperatorData(token);
      } else {
        Alert.alert('Error', data.message || 'Failed to assign driver');
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // Unassign driver from tricycle
  const handleUnassignDriver = async (tricycleId) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    Alert.alert(
      'Confirm Unassign',
      'Are you sure you want to unassign this driver?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${BACKEND}/api/operator/unassign-driver`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ tricycleId }),
              });

              const data = await res.json();
              if (data.success) {
                Alert.alert('Success', 'Driver unassigned successfully');
                await fetchOperatorData(token);
              } else {
                Alert.alert('Error', data.message || 'Failed to unassign driver');
              }
            } catch (error) {
              console.error('Error unassigning driver:', error);
              Alert.alert('Error', 'Failed to unassign driver. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Create new tricycle
  const handleCreateTricycle = async () => {
    if (!newTricycle.plateNumber || !newTricycle.model) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${BACKEND}/api/tricycles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plateNumber: newTricycle.plateNumber,
          model: newTricycle.model,
          status: 'unavailable',
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Tricycle added successfully');
        setAddTricycleModalVisible(false);
        setNewTricycle({ plateNumber: '', model: '' });
        await fetchOperatorData(token);
      } else {
        Alert.alert('Error', data.message || 'Failed to create tricycle');
      }
    } catch (error) {
      console.error('Error creating tricycle:', error);
      Alert.alert('Error', 'Failed to create tricycle. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Open assign driver modal
  const openAssignModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setAssignModalVisible(true);
  };

  // messaging helpers
  const openMessage = (tricycle) => {
    setSelectedTricycle(tricycle);
    setMessageText('');
    setMsgModalVisible(true);
  };

  const sendMessage = async () => {
    if (!selectedTricycle) return;
    const text = messageText.trim();
    if (!text) return Alert.alert('Message required', 'Please enter a message.');
    setSending(true);
    // TODO: Implement message sending to backend
    Alert.alert('Info', 'Message functionality coming soon');
    setMsgModalVisible(false);
    setSending(false);
  };

  // forums helpers
  const postThread = async () => {
    const text = newThreadText.trim();
    if (!text) return Alert.alert('Required', 'Please enter thread content.');
    setPosting(true);
    // TODO: Implement forum posting to backend
    setThreads((prev) => [{ id: `local-${Date.now()}`, text, author: 'operator', ts: new Date().toISOString() }, ...prev]);
    setNewThreadText('');
    setPosting(false);
  };

  // Tab screens
  function OverviewTab() {
    if (loading && !refreshing) return <CenterLoader />;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Tricycle Overview</Text>
              <Text style={styles.subtitle}>Manage your tricycles and drivers</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAddTricycleModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={tricycles}
          keyExtractor={(item) => item.id || item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const tricycle = item;
            const last = (messages[tricycle.id] && messages[tricycle.id].length) ? messages[tricycle.id][messages[tricycle.id].length - 1] : null;
            const driverName = tricycle.driverName || (tricycle.driver ? `${tricycle.driver.firstname} ${tricycle.driver.lastname}` : 'Unassigned');
            const hasDriver = tricycle.driverId || tricycle.driver;

            return (
              <View style={styles.itemWrap}>
                <TouchableOpacity 
                  style={styles.item} 
                  onPress={() => navigation?.navigate('Home', { vehicleId: tricycle.id })}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name="car-sport-outline" size={28} color="#fff" />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.plate}>{tricycle.plate || tricycle.plateNumber}</Text>
                    <Text style={styles.driver}>{driverName}</Text>
                    <Text style={styles.meta}>
                      {tricycle.status || 'unavailable'} • Model: {tricycle.model || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.chev}>{'>'}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.actionsRow}>
                  {hasDriver ? (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.assignBtn]} 
                        onPress={() => openAssignModal(tricycle)}
                      >
                        <Ionicons name="person-outline" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Change Driver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.unassignBtn]} 
                        onPress={() => handleUnassignDriver(tricycle.id || tricycle._id)}
                      >
                        <Ionicons name="person-remove-outline" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Unassign</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.assignBtn]} 
                      onPress={() => openAssignModal(tricycle)}
                    >
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Assign Driver</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.messageBtn]} 
                    onPress={() => openMessage(tricycle)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>

                {last && (
                  <View style={styles.msgPreview}>
                    <Text style={styles.msgPreviewText}>
                      {last.from === 'operator' ? 'You: ' : ''}{last.text.length > 40 ? last.text.slice(0, 40) + '…' : last.text}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={64} color={colors.orangeShade5} />
                <Text style={styles.emptyText}>No tricycles yet</Text>
                <Text style={styles.emptySubtext}>Tap the + button to add a tricycle</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </SafeAreaView>
    );
  }

  function DriversTab() {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Available Drivers</Text>
          <Text style={styles.subtitle}>Drivers not assigned to any tricycle</Text>
        </View>
        <FlatList
          data={availableDrivers}
          keyExtractor={(item) => item._id || item.id}
          renderItem={({ item }) => (
            <View style={styles.driverItem}>
              <View style={styles.driverAvatar}>
                {item.image?.url ? (
                  <Image source={{ uri: item.image.url }} style={styles.driverAvatarImage} />
                ) : (
                  <Ionicons name="person" size={32} color={colors.orangeShade5} />
                )}
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>
                  {item.firstname} {item.lastname}
                </Text>
                <Text style={styles.driverUsername}>@{item.username}</Text>
                {item.rating > 0 && (
                  <Text style={styles.driverRating}>
                    ⭐ {item.rating.toFixed(1)} ({item.numReviews} reviews)
                  </Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.orangeShade5} />
              <Text style={styles.emptyText}>No available drivers</Text>
              <Text style={styles.emptySubtext}>All drivers are currently assigned</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  function SickLeaveTab() {
    // Placeholder for sick leave - can be implemented later
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sick Leave Updates</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="medical-outline" size={64} color={colors.orangeShade5} />
          <Text style={styles.emptyText}>No sick leave updates</Text>
        </View>
      </SafeAreaView>
    );
  }

  function MaintenanceTab() {
    // Placeholder for maintenance - can be implemented later
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Maintenance Updates</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="build-outline" size={64} color={colors.orangeShade5} />
          <Text style={styles.emptyText}>No maintenance updates</Text>
        </View>
      </SafeAreaView>
    );
  }

  function ForumsTab() {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingBottom: 4 }]}>
          <Text style={styles.title}>Forums</Text>
          <Text style={styles.subtitle}>Post announcements or talk to all drivers</Text>
        </View>

        <View style={{ padding: spacing.medium }}>
          <TextInput
            style={[styles.textInput, { height: 80 }]}
            placeholder="Write an announcement or start a thread..."
            multiline
            value={newThreadText}
            onChangeText={setNewThreadText}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={postThread} disabled={posting}>
              <Text style={styles.modalBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.threadItem}>
              <Text style={{ fontWeight: '700' }}>{item.author || 'Operator'}</Text>
              <Text style={{ color: colors.orangeShade5, marginTop: 4 }}>{item.text}</Text>
              <Text style={{ color: '#999', marginTop: 6, fontSize: 12 }}>{new Date(item.ts || Date.now()).toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ padding: spacing.medium }}>No forum threads yet</Text>}
        />
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) return <CenterLoader />;

  return (
    <>
      <Tab.Navigator
        initialRouteName="Overview"
        screenOptions={{
          tabBarIndicatorStyle: { backgroundColor: colors.primary },
          tabBarActiveTintColor: colors.primary,
          tabBarLabelStyle: { fontWeight: '600' },
          tabBarStyle: { backgroundColor: 'white' },
        }}
      >
        <Tab.Screen name="Overview" component={OverviewTab} />
        <Tab.Screen name="Drivers" component={DriversTab} />
        <Tab.Screen name="Sick Leave" component={SickLeaveTab} />
        <Tab.Screen name="Maintenance" component={MaintenanceTab} />
        <Tab.Screen name="Forums" component={ForumsTab} />
      </Tab.Navigator>

      {/* Add Tricycle Modal */}
      <Modal visible={addTricycleModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Tricycle</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Plate Number"
              value={newTricycle.plateNumber}
              onChangeText={(text) => setNewTricycle({ ...newTricycle, plateNumber: text.toUpperCase() })}
              editable={!creating}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Model"
              value={newTricycle.model}
              onChangeText={(text) => setNewTricycle({ ...newTricycle, model: text })}
              editable={!creating}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => {
                  setAddTricycleModalVisible(false);
                  setNewTricycle({ plateNumber: '', model: '' });
                }} 
                disabled={creating}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.primary }]} 
                onPress={handleCreateTricycle} 
                disabled={creating}
              >
                <Text style={styles.modalBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Driver Modal */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <Text style={styles.modalSub}>
              Select a driver for {selectedTricycle?.plate || selectedTricycle?.plateNumber || 'this tricycle'}
            </Text>
            <ScrollView style={styles.driverList}>
              {availableDrivers.length === 0 ? (
                <Text style={styles.emptyText}>No available drivers</Text>
              ) : (
                availableDrivers.map((driver) => (
                  <TouchableOpacity
                    key={driver._id || driver.id}
                    style={styles.driverOption}
                    onPress={() => handleAssignDriver(selectedTricycle?.id || selectedTricycle?._id, driver._id || driver.id)}
                    disabled={assigning}
                  >
                    <View style={styles.driverOptionAvatar}>
                      {driver.image?.url ? (
                        <Image source={{ uri: driver.image.url }} style={styles.driverOptionAvatarImage} />
                      ) : (
                        <Ionicons name="person" size={24} color={colors.orangeShade5} />
                      )}
                    </View>
                    <View style={styles.driverOptionInfo}>
                      <Text style={styles.driverOptionName}>
                        {driver.firstname} {driver.lastname}
                      </Text>
                      <Text style={styles.driverOptionUsername}>@{driver.username}</Text>
                    </View>
                    {assigning && <ActivityIndicator size="small" color={colors.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => setAssignModalVisible(false)} 
                disabled={assigning}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Message Modal */}
      <Modal visible={msgModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Message {selectedTricycle?.plate || selectedTricycle?.plateNumber || ''}</Text>
            <Text style={styles.modalSub}>{selectedTricycle?.driverName || 'No driver assigned'}</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Type a private message..."
              multiline
              value={messageText}
              onChangeText={setMessageText}
              editable={!sending}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} onPress={() => setMsgModalVisible(false)} disabled={sending}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={sendMessage} disabled={sending}>
                <Text style={styles.modalBtnText}>{sending ? 'Sending...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// Helper component
function CenterLoader() {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.medium, paddingBottom: 8 },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.orangeShade7 },
  subtitle: { color: colors.orangeShade5, marginTop: 4, fontSize: 12 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: spacing.medium,
    backgroundColor: '#fee',
    marginHorizontal: spacing.medium,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  errorText: { color: '#c00', marginBottom: 8 },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: spacing.small,
    textAlign: 'center',
  },

  itemWrap: { marginBottom: spacing.small },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  info: { flex: 1 },
  plate: { fontWeight: '700', color: colors.orangeShade7, fontSize: 16 },
  driver: { color: colors.orangeShade5, marginTop: 4 },
  meta: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
  right: { width: 24, alignItems: 'flex-end' },
  chev: { color: colors.orangeShade5 },

  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    marginTop: 8,
    marginBottom: spacing.small,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  assignBtn: { backgroundColor: colors.primary },
  unassignBtn: { backgroundColor: '#dc3545' },
  messageBtn: { backgroundColor: '#6c757d' },
  actionBtnText: { color: '#fff', marginLeft: 6, fontWeight: '600', fontSize: 12 },

  msgPreview: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small,
  },
  msgPreviewText: { color: colors.orangeShade5, fontSize: 12 },

  driverItem: {
    flexDirection: 'row',
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginBottom: spacing.small,
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  driverAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverInfo: { flex: 1 },
  driverName: { fontWeight: '700', color: colors.orangeShade7 },
  driverUsername: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
  driverRating: { color: colors.orangeShade5, fontSize: 12, marginTop: 4 },

  noticeItem: {
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },

  threadItem: {
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginBottom: spacing.small,
  },

  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.orangeShade7, marginBottom: 8 },
  modalSub: { color: colors.orangeShade5, marginBottom: 16, fontSize: 14 },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.small,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.medium },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  modalBtnText: { color: '#fff', fontWeight: '700' },

  driverList: {
    maxHeight: 300,
    marginBottom: spacing.medium,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  driverOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  driverOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  driverOptionInfo: { flex: 1 },
  driverOptionName: { fontWeight: '600', color: colors.orangeShade7 },
  driverOptionUsername: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
});
