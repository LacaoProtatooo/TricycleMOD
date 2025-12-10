import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import Constants from 'expo-constants';

// Tab Components
import OverviewTab from './tabs/OverviewTab';
import DriversTab from './tabs/DriversTab';
import SickLeaveTab from './tabs/SickLeaveTab';
import ForumsTab from './tabs/ForumsTab';
import ReceiptScannerTab from './tabs/ReceiptScannerTab';

// Modal Components
import AddTricycleModal from './modals/AddTricycleModal';
import AssignDriverModal from './modals/AssignDriverModal';
import MaintenanceModal from './modals/MaintenanceModal';
import TricycleDetailsModal from './modals/TricycleDetailsModal';
import MessageSelectionModal from './modals/MessageSelectionModal';
import UnassignDriverModal from './modals/UnassignDriverModal';

// Helper Components
import LoadingScreen from './LoadingScreen';

// Utils
import { 
  fetchOperatorData, 
  handleAssignDriver, 
  handleUnassignDriver, 
  handleCreateTricycle 
} from './operatorHelpers';

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

  // Modal states
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignmentType, setAssignmentType] = useState('exclusive');
  const [schedule, setSchedule] = useState({ days: [], startTime: '08:00', endTime: '17:00' });

  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedTricycleHistory, setSelectedTricycleHistory] = useState([]);

  const [addTricycleModalVisible, setAddTricycleModalVisible] = useState(false);
  const [newTricycle, setNewTricycle] = useState({ plateNumber: '', model: '', currentOdometer: '' });
  const [creating, setCreating] = useState(false);

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [unassignModalVisible, setUnassignModalVisible] = useState(false);
  const [tricycleToUnassign, setTricycleToUnassign] = useState(null);
  const [messageSelectionModalVisible, setMessageSelectionModalVisible] = useState(false);

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
          await fetchData(authToken);
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

  const fetchData = async (authToken) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOperatorData(authToken, BACKEND);
      setTricycles(data.tricycles || []);
      setDrivers(data.allDrivers || data.drivers || []);
      setAvailableDrivers(data.availableDrivers || []);
    } catch (e) {
      console.error('Error fetching operator data:', e);
      setError(e.message || 'Failed to fetch operator data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (token) {
      await fetchData(token);
    } else if (db) {
      await loadTokenAndFetchData();
    }
  };

  const assignDriver = async (tricycleId, driverId) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    const payload = { tricycleId, driverId };
    if (assignmentType === 'shared') {
      payload.schedule = schedule;
    }

    const result = await handleAssignDriver(token, BACKEND, payload);
    if (result.success) {
      setAssignModalVisible(false);
      await fetchData(token);
    }
  };

  const unassignDriver = async (tricycle) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    if (tricycle.schedules && tricycle.schedules.length > 0) {
      setTricycleToUnassign(tricycle);
      setUnassignModalVisible(true);
      return;
    }

    // Confirm for exclusive assignment
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
      const result = await handleUnassignDriver(token, BACKEND, { tricycleId, driverId });
      if (result.success) {
        setUnassignModalVisible(false);
        await fetchData(token);
      }
    } catch (error) {
      console.error('Error unassigning driver:', error);
      Alert.alert('Error', 'Failed to unassign driver. Please try again.');
    }
  };

  const createTricycle = async () => {
    if (!newTricycle.plateNumber || !newTricycle.model) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    const result = await handleCreateTricycle(token, BACKEND, newTricycle);
    if (result.success) {
      setAddTricycleModalVisible(false);
      setNewTricycle({ plateNumber: '', model: '', currentOdometer: '' });
      await fetchData(token);
    }
  };

  const openMessage = (tricycle) => {
    if (tricycle.driver) {
      navigation.navigate('Chat', {
        userId: tricycle.driver._id || tricycle.driver.id,
        userName: `${tricycle.driver.firstname} ${tricycle.driver.lastname}`,
        userImage: tricycle.driver.image?.url
      });
      return;
    }

    if (tricycle.schedules && tricycle.schedules.length > 0) {
      setSelectedTricycle(tricycle);
      setMessageSelectionModalVisible(true);
      return;
    }

    Alert.alert('No Driver', 'There is no driver assigned to this tricycle.');
  };

  const openAssignModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setAssignModalVisible(true);
  };

  const openMaintenanceModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setSelectedTricycleHistory(tricycle.maintenanceHistory || []);
    setMaintenanceModalVisible(true);
  };

  const openDetailsModal = (tricycle) => {
    setSelectedTricycle(tricycle);
    setDetailsModalVisible(true);
  };

  if (loading && !refreshing) return <LoadingScreen />;

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
        <Tab.Screen name="Overview">
          {() => (
            <OverviewTab
              loading={loading}
              refreshing={refreshing}
              error={error}
              tricycles={tricycles}
              onRefresh={onRefresh}
              onAddTricycle={() => setAddTricycleModalVisible(true)}
              onOpenAssignModal={openAssignModal}
              onUnassignDriver={unassignDriver}
              onOpenMessage={openMessage}
              onOpenMaintenance={openMaintenanceModal}
              onOpenDetails={openDetailsModal}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Drivers">
          {() => <DriversTab availableDrivers={availableDrivers} />}
        </Tab.Screen>
        <Tab.Screen name="Receipt">
          {() => <ReceiptScannerTab token={token} BACKEND={BACKEND} />}
        </Tab.Screen>
        <Tab.Screen name="Sick Leave">
          {() => <SickLeaveTab token={token} BACKEND={BACKEND} />}
        </Tab.Screen>
        <Tab.Screen name="Forums">
          {() => <ForumsTab token={token} BACKEND={BACKEND} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Modals */}
      <AddTricycleModal
        visible={addTricycleModalVisible}
        onClose={() => {
          setAddTricycleModalVisible(false);
          setNewTricycle({ plateNumber: '', model: '', currentOdometer: '' });
        }}
        onSubmit={createTricycle}
        newTricycle={newTricycle}
        setNewTricycle={setNewTricycle}
        creating={creating}
      />

      <AssignDriverModal
        visible={assignModalVisible}
        onClose={() => setAssignModalVisible(false)}
        onSubmit={assignDriver}
        availableDrivers={availableDrivers}
        selectedTricycle={selectedTricycle}
        assigning={assigning}
        assignmentType={assignmentType}
        setAssignmentType={setAssignmentType}
        schedule={schedule}
        setSchedule={setSchedule}
      />

      <MaintenanceModal
        visible={maintenanceModalVisible}
        onClose={() => setMaintenanceModalVisible(false)}
        selectedTricycle={selectedTricycle}
        history={selectedTricycleHistory}
      />

      <TricycleDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        selectedTricycle={selectedTricycle}
      />

      <MessageSelectionModal
        visible={messageSelectionModalVisible}
        onClose={() => setMessageSelectionModalVisible(false)}
        selectedTricycle={selectedTricycle}
        navigation={navigation}
      />

      <UnassignDriverModal
        visible={unassignModalVisible}
        onClose={() => setUnassignModalVisible(false)}
        tricycleToUnassign={tricycleToUnassign}
        onConfirmUnassign={confirmUnassign}
      />
    </>
  );
}

// Import styles
import { colors } from '../../components/common/theme';