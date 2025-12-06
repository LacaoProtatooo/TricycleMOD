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
import * as ImagePicker from 'expo-image-picker';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { useSelector } from 'react-redux';

const BACKEND = (Constants?.expoConfig?.extra?.BACKEND_URL) || (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.105:5000';
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
  const [assignmentType, setAssignmentType] = useState('exclusive'); // 'exclusive' or 'shared'
  const [schedule, setSchedule] = useState({ days: [], startTime: '08:00', endTime: '17:00' });

  // Maintenance modal
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedTricycleHistory, setSelectedTricycleHistory] = useState([]);

  // Add tricycle modal
  const [addTricycleModalVisible, setAddTricycleModalVisible] = useState(false);
  const [newTricycle, setNewTricycle] = useState({ plateNumber: '', model: '', currentOdometer: '' });
  const [creating, setCreating] = useState(false);

  // Details modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Unassign modal
  const [unassignModalVisible, setUnassignModalVisible] = useState(false);
  const [tricycleToUnassign, setTricycleToUnassign] = useState(null);

  // Message selection modal (for shared drivers)
  const [messageSelectionModalVisible, setMessageSelectionModalVisible] = useState(false);

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
      const payload = { tricycleId, driverId };
      if (assignmentType === 'shared') {
          payload.schedule = schedule;
      }

      const res = await fetch(`${BACKEND}/api/operator/assign-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
  const handleUnassignDriver = async (tricycle) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    // Check if shared schedule
    if (tricycle.schedules && tricycle.schedules.length > 0) {
        setTricycleToUnassign(tricycle);
        setUnassignModalVisible(true);
        return;
    }

    // Exclusive assignment (legacy behavior)
    Alert.alert(
      'Confirm Unassign',
      'Are you sure you want to unassign this driver?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => confirmUnassign(tricycle.id || tricycle._id)
        },
      ]
    );
  };

  const confirmUnassign = async (tricycleId, driverId = null) => {
    try {
        const payload = { tricycleId };
        if (driverId) payload.driverId = driverId;

        const res = await fetch(`${BACKEND}/api/operator/unassign-driver`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
        Alert.alert('Success', 'Driver unassigned successfully');
        setUnassignModalVisible(false);
        await fetchOperatorData(token);
        } else {
        Alert.alert('Error', data.message || 'Failed to unassign driver');
        }
    } catch (error) {
        console.error('Error unassigning driver:', error);
        Alert.alert('Error', 'Failed to unassign driver. Please try again.');
    }
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
          currentOdometer: newTricycle.currentOdometer ? parseFloat(newTricycle.currentOdometer) : 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Tricycle added successfully');
        setAddTricycleModalVisible(false);
        setNewTricycle({ plateNumber: '', model: '', currentOdometer: '' });
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

  // Open maintenance modal
  const openMaintenanceModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setSelectedTricycleHistory(tricycle.maintenanceHistory || []);
    setMaintenanceModalVisible(true);
  };

  // Open details modal
  const openDetailsModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setDetailsModalVisible(true);
  };

  // messaging helpers
  const openMessage = (tricycle) => {
    // Check for exclusive driver
    if (tricycle.driver) {
        navigation.navigate('Chat', {
            userId: tricycle.driver._id || tricycle.driver.id,
            userName: `${tricycle.driver.firstname} ${tricycle.driver.lastname}`,
            userImage: tricycle.driver.image?.url
        });
        return;
    }

    // Check for shared drivers
    if (tricycle.schedules && tricycle.schedules.length > 0) {
        setSelectedTricycle(tricycle);
        setMessageSelectionModalVisible(true);
        return;
    }

    Alert.alert('No Driver', 'There is no driver assigned to this tricycle.');
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
            const driverName = tricycle.driverName || (tricycle.driver ? `${tricycle.driver.firstname} ${tricycle.driver.lastname}` : 'Unassigned');
            const hasDriver = tricycle.driverId || tricycle.driver;

            return (
              <View style={styles.itemWrap}>
                <TouchableOpacity 
                  style={styles.item} 
                  onPress={() => openDetailsModal(tricycle)}
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
                        onPress={() => handleUnassignDriver(tricycle)}
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
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#17a2b8' }]} 
                    onPress={() => openMaintenanceModal(tricycle)}
                  >
                    <Ionicons name="build-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Logs</Text>
                  </TouchableOpacity>
                </View>
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
    const [sickLeaves, setSickLeaves] = useState([]);
    const [loadingSL, setLoadingSL] = useState(false);

    useEffect(() => {
        if (token) fetchSickLeaves();
    }, [token]);

    const fetchSickLeaves = async () => {
        setLoadingSL(true);
        try {
            const res = await fetch(`${BACKEND}/api/sick-leave/operator`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSickLeaves(data.data);
            }
        } catch (error) {
            console.error('Error fetching sick leaves:', error);
        } finally {
            setLoadingSL(false);
        }
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sick Leave Updates</Text>
          <TouchableOpacity onPress={fetchSickLeaves} style={{ padding: 8 }}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {loadingSL ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
            <FlatList
                data={sickLeaves}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: spacing.medium }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="medical-outline" size={64} color={colors.orangeShade5} />
                        <Text style={styles.emptyText}>No sick leave updates</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={{ 
                        backgroundColor: '#fff', 
                        padding: 12, 
                        borderRadius: 8, 
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange',
                        elevation: 2
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            {item.driver?.image?.url ? (
                                <Image source={{ uri: item.driver.image.url }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }} />
                            ) : (
                                <Ionicons name="person-circle" size={32} color="#ccc" style={{ marginRight: 8 }} />
                            )}
                            <View>
                                <Text style={{ fontWeight: '700' }}>{item.driver?.firstname} {item.driver?.lastname}</Text>
                                <Text style={{ fontSize: 12, color: '#666' }}>@{item.driver?.username}</Text>
                            </View>
                        </View>
                        
                        <Text style={{ fontWeight: '600', marginBottom: 4 }}>
                            {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                        </Text>
                        <Text style={{ color: '#444', fontStyle: 'italic' }}>"{item.reason}"</Text>
                        
                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <Text style={{ 
                                fontSize: 12, 
                                fontWeight: '700', 
                                color: item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange' 
                            }}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                )}
            />
        )}
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

  function ReceiptScannerTab() {
    const [image, setImage] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);

    const askPermissions = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Camera roll permission is required to select images');
          return false;
        }
        const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (camStatus !== 'granted') {
          // camera permission denied - still allow gallery
        }
        return true;
      } catch (e) {
        return false;
      }
    };

    const pickImage = async () => {
      // request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is needed.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      // handle both old and new API shapes
      if (result?.canceled === true) return; // user cancelled
      let uri = null;
      if (result?.assets && result.assets.length > 0) uri = result.assets[0].uri;
      else if (result?.uri) uri = result.uri;

      if (!uri) {
        Alert.alert('No image selected');
        return;
      }

      setImage(uri);
      setOcrResult(null);
    };

    const takePhoto = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to use camera is needed.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result?.canceled === true) return;
      let uri = null;
      if (result?.assets && result.assets.length > 0) uri = result.assets[0].uri;
      else if (result?.uri) uri = result.uri;

      if (!uri) {
        Alert.alert('No image selected');
        return;
      }

      setImage(uri);
      setOcrResult(null);
    };

    const uploadAndScan = async () => {
      if (!image) return Alert.alert('No image', 'Please select or take a photo first');
      if (!token) return Alert.alert('Not authenticated', 'Please login');
      setScanning(true);
      setOcrResult(null);
      try {
        const form = new FormData();
        const uriParts = image.split('/');
        const name = uriParts[uriParts.length - 1];
        const file = {
          uri: image,
          name: name,
          type: 'image/jpeg',
        };
        form.append('image', file);

        const res = await fetch(`${BACKEND}/api/operator/scan-receipt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          body: form,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setOcrResult(data.data);
        } else {
          console.error('OCR error', data);
          Alert.alert('OCR failed', data.message || 'See console for details');
        }
      } catch (e) {
        console.error('Upload error', e);
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setScanning(false);
      }
    };

    return (
      <SafeAreaView style={[styles.container, { padding: spacing.medium }]}> 
        <Text style={styles.title}>Receipt Scanner</Text>
        <Text style={styles.subtitle}>Take or choose a receipt photo to extract text</Text>

        <View style={{ marginTop: spacing.medium, alignItems: 'center' }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: 280, height: 180, borderRadius: 8 }} resizeMode="cover" />
          ) : (
            <View style={{ width: 280, height: 180, borderRadius: 8, backgroundColor: '#f4f4f4', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="images" size={48} color={colors.orangeShade5} />
              <Text style={{ color: colors.orangeShade5, marginTop: 8 }}>No image selected</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', marginTop: spacing.medium, gap: 8 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={pickImage}>
              <Text style={styles.modalBtnText}>Pick Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} onPress={takePhoto}>
              <Text style={styles.modalBtnText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#0d6efd', marginTop: spacing.medium }]} onPress={uploadAndScan} disabled={scanning}>
            <Text style={styles.modalBtnText}>{scanning ? 'Scanning...' : 'Scan Receipt'}</Text>
          </TouchableOpacity>

          {ocrResult && (
            <ScrollView style={{ marginTop: spacing.medium, width: '100%', maxHeight: 260 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>OCR Result</Text>
              {ocrResult.lines && ocrResult.lines.length > 0 ? (
                ocrResult.lines.map((l, idx) => (
                  <Text key={idx} style={{ marginBottom: 6 }}>{l.text || l.raw || JSON.stringify(l)}</Text>
                ))
              ) : (
                <Text>No text found</Text>
              )}
            </ScrollView>
          )}
        </View>
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
        <Tab.Screen name="Receipt" component={ReceiptScannerTab} />
        <Tab.Screen name="Sick Leave" component={SickLeaveTab} />
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
            <TextInput
              style={styles.textInput}
              placeholder="Initial Odometer (km)"
              value={newTricycle.currentOdometer}
              onChangeText={(text) => setNewTricycle({ ...newTricycle, currentOdometer: text })}
              keyboardType="numeric"
              editable={!creating}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => {
                  setAddTricycleModalVisible(false);
                  setNewTricycle({ plateNumber: '', model: '', currentOdometer: '' });
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

            {/* Assignment Type Toggle */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <TouchableOpacity 
                    style={{ 
                        flex: 1, 
                        padding: 10, 
                        backgroundColor: assignmentType === 'exclusive' ? colors.primary : '#eee',
                        alignItems: 'center',
                        borderTopLeftRadius: 8,
                        borderBottomLeftRadius: 8
                    }}
                    onPress={() => setAssignmentType('exclusive')}
                >
                    <Text style={{ color: assignmentType === 'exclusive' ? '#fff' : '#333', fontWeight: '600' }}>Exclusive</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={{ 
                        flex: 1, 
                        padding: 10, 
                        backgroundColor: assignmentType === 'shared' ? colors.primary : '#eee',
                        alignItems: 'center',
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8
                    }}
                    onPress={() => setAssignmentType('shared')}
                >
                    <Text style={{ color: assignmentType === 'shared' ? '#fff' : '#333', fontWeight: '600' }}>Shared Schedule</Text>
                </TouchableOpacity>
            </View>

            {assignmentType === 'shared' && (
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ marginBottom: 8, fontWeight: '600' }}>Schedule Days:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <TouchableOpacity 
                                key={day}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    backgroundColor: schedule.days.includes(day) ? colors.primary : '#eee'
                                }}
                                onPress={() => {
                                    const newDays = schedule.days.includes(day) 
                                        ? schedule.days.filter(d => d !== day)
                                        : [...schedule.days, day];
                                    setSchedule({ ...schedule, days: newDays });
                                }}
                            >
                                <Text style={{ color: schedule.days.includes(day) ? '#fff' : '#333', fontSize: 12 }}>{day}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, marginBottom: 4 }}>Start Time</Text>
                            <TextInput 
                                style={[styles.textInput, { marginBottom: 0 }]} 
                                value={schedule.startTime}
                                onChangeText={(t) => setSchedule({...schedule, startTime: t})}
                                placeholder="08:00"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, marginBottom: 4 }}>End Time</Text>
                            <TextInput 
                                style={[styles.textInput, { marginBottom: 0 }]} 
                                value={schedule.endTime}
                                onChangeText={(t) => setSchedule({...schedule, endTime: t})}
                                placeholder="17:00"
                            />
                        </View>
                    </View>
                </View>
            )}

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

      {/* Message Selection Modal (Shared Drivers) */}
      <Modal visible={messageSelectionModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Driver to Message</Text>
            <Text style={styles.modalSub}>
              Who do you want to message regarding {selectedTricycle?.plate || selectedTricycle?.plateNumber}?
            </Text>

            <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
                {selectedTricycle?.schedules && selectedTricycle.schedules.map((sch, idx) => (
                    <TouchableOpacity 
                        key={idx} 
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginBottom: 12, 
                            padding: 12, 
                            backgroundColor: '#f9f9f9', 
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#eee'
                        }}
                        onPress={() => {
                            setMessageSelectionModalVisible(false);
                            navigation.navigate('Chat', {
                                userId: sch.driver._id || sch.driver.id,
                                userName: `${sch.driver.firstname} ${sch.driver.lastname}`,
                                userImage: sch.driver.image?.url
                            });
                        }}
                    >
                        {sch.driver?.image?.url ? (
                            <Image source={{ uri: sch.driver.image.url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                        ) : (
                            <Ionicons name="person-circle-outline" size={40} color={colors.orangeShade5} style={{ marginRight: 12 }} />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', fontSize: 16 }}>{sch.driver?.firstname} {sch.driver?.lastname}</Text>
                            <Text style={{ fontSize: 12, color: '#666' }}>
                                {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                            </Text>
                        </View>
                        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => setMessageSelectionModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Maintenance History Modal */}
      <Modal visible={maintenanceModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Maintenance Logs</Text>
            <Text style={styles.modalSub}>
              {selectedTricycle?.plate || selectedTricycle?.plateNumber} • Odometer: {selectedTricycle?.currentOdometer || 0} km
            </Text>
            
            <ScrollView style={{ marginBottom: 16 }}>
              {selectedTricycleHistory.length === 0 ? (
                <Text style={styles.emptyText}>No maintenance records found.</Text>
              ) : (
                selectedTricycleHistory.slice().reverse().map((log, index) => (
                  <View key={index} style={{ 
                    padding: 12, 
                    borderBottomWidth: 1, 
                    borderBottomColor: '#eee',
                    marginBottom: 8 
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: colors.orangeShade7 }}>
                        {log.itemKey.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#999' }}>
                        {new Date(log.completedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={{ marginTop: 4, color: colors.orangeShade5 }}>
                      Service at: {log.lastServiceKm} km
                    </Text>
                    {log.notes && (
                      <Text style={{ marginTop: 4, fontStyle: 'italic', fontSize: 12, color: '#666' }}>
                        "{log.notes}"
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => setMaintenanceModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tricycle Details Modal */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vehicle Details</Text>
            <Text style={styles.modalSub}>
              {selectedTricycle?.plate || selectedTricycle?.plateNumber} • {selectedTricycle?.model}
            </Text>

            <View style={{ marginVertical: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8, color: colors.orangeShade7 }}>Primary Driver</Text>
                {selectedTricycle?.driver ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        {selectedTricycle.driver.image?.url ? (
                            <Image source={{ uri: selectedTricycle.driver.image.url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                        ) : (
                            <Ionicons name="person-circle-outline" size={40} color={colors.orangeShade5} style={{ marginRight: 12 }} />
                        )}
                        <View>
                            <Text style={{ fontWeight: '600' }}>{selectedTricycle.driver.firstname} {selectedTricycle.driver.lastname}</Text>
                            <Text style={{ fontSize: 12, color: '#666' }}>@{selectedTricycle.driver.username}</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={{ fontStyle: 'italic', color: '#999', marginBottom: 12 }}>No primary driver assigned</Text>
                )}

                <Text style={{ fontWeight: '700', marginBottom: 8, color: colors.orangeShade7, marginTop: 8 }}>Scheduled Drivers</Text>
                {selectedTricycle?.schedules && selectedTricycle.schedules.length > 0 ? (
                    <ScrollView style={{ maxHeight: 200 }}>
                        {selectedTricycle.schedules.map((sch, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
                                {sch.driver?.image?.url ? (
                                    <Image source={{ uri: sch.driver.image.url }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                                ) : (
                                    <Ionicons name="person-circle-outline" size={32} color={colors.orangeShade5} style={{ marginRight: 10 }} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '600', fontSize: 14 }}>{sch.driver?.firstname} {sch.driver?.lastname}</Text>
                                    <Text style={{ fontSize: 12, color: '#666' }}>
                                        {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={{ fontStyle: 'italic', color: '#999' }}>No scheduled drivers</Text>
                )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unassign Driver Modal */}
      <Modal visible={unassignModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Unassign Driver</Text>
            <Text style={styles.modalSub}>
              Select a driver to remove from {tricycleToUnassign?.plate || tricycleToUnassign?.plateNumber}
            </Text>

            <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
                {tricycleToUnassign?.schedules && tricycleToUnassign.schedules.map((sch, idx) => (
                    <TouchableOpacity 
                        key={idx} 
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginBottom: 12, 
                            padding: 12, 
                            backgroundColor: '#f9f9f9', 
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#eee'
                        }}
                        onPress={() => {
                            Alert.alert(
                                'Confirm Unassign',
                                `Remove ${sch.driver?.firstname} from schedule?`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    { 
                                        text: 'Remove', 
                                        style: 'destructive', 
                                        onPress: () => confirmUnassign(tricycleToUnassign._id || tricycleToUnassign.id, sch.driver?._id || sch.driver?.id) 
                                    }
                                ]
                            );
                        }}
                    >
                        {sch.driver?.image?.url ? (
                            <Image source={{ uri: sch.driver.image.url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                        ) : (
                            <Ionicons name="person-circle-outline" size={40} color={colors.orangeShade5} style={{ marginRight: 12 }} />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', fontSize: 16 }}>{sch.driver?.firstname} {sch.driver?.lastname}</Text>
                            <Text style={{ fontSize: 12, color: '#666' }}>
                                {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                            </Text>
                        </View>
                        <Ionicons name="trash-outline" size={20} color="#dc3545" />
                    </TouchableOpacity>
                ))}
                
                {/* Option to clear all/reset */}
                <TouchableOpacity 
                    style={{ 
                        padding: 12, 
                        backgroundColor: '#fee', 
                        borderRadius: 8, 
                        alignItems: 'center',
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#fcc'
                    }}
                    onPress={() => {
                        Alert.alert(
                            'Confirm Clear All',
                            'Remove ALL drivers from this tricycle?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                    text: 'Clear All', 
                                    style: 'destructive', 
                                    onPress: () => confirmUnassign(tricycleToUnassign._id || tricycleToUnassign.id) 
                                }
                            ]
                        );
                    }}
                >
                    <Text style={{ color: '#dc3545', fontWeight: '600' }}>Unassign All Drivers</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={() => setUnassignModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
