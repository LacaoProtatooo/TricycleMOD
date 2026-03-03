import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { colors } from '../../components/common/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../utils/config';

// Redux Actions
import { 
  fetchOperatorData, 
  assignDriver, 
  unassignDriver, 
  createTricycle,
  fetchSickLeaves,
  approveSickLeave,
  rejectSickLeave,
  clearErrors
} from '../../redux/actions/operatorAction';

// Tab Components
import OverviewTab from './tabs/OverviewTab';
import DriversTab from './tabs/DriversTab';
import SickLeaveTab from './tabs/SickLeaveTab';
import DriverComplaintsTab from './tabs/DriverComplaintsTab';
import MaintenanceApprovalTab from './tabs/MaintenanceApprovalTab';

// Modal Components
import AddTricycleModal from './modals/AddTricycleModal';
import AssignDriverModal from './modals/AssignDriverModal';
import MaintenanceModal from './modals/MaintenanceModal';
import TricycleDetailsModal from './modals/TricycleDetailsModal';
import MessageSelectionModal from './modals/MessageSelectionModal';
import UnassignDriverModal from './modals/UnassignDriverModal';

// Helper Components
import LoadingScreen from '../../components/common/LoadingScreen';

// Utils
import { validateTricycleData, validateSchedule } from './operatorHelpers';

const BACKEND = API_URL;
const Tab = createBottomTabNavigator();

export default function OperatorScreen({ navigation }) {
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext();
  const insets = useSafeAreaInsets();
  
  // Get state from Redux store
  const user = useSelector((state) => state.auth.user);
  const operatorState = useSelector((state) => state.operator);
  
  const {
    tricycles = [],
    drivers = [],
    availableDrivers = [],
    sickLeaves = [],
    sickLeaveStatistics,
    loading,
    loadingSickLeaves,
    assigning,
    creating,
    unassigning,
    error
  } = operatorState;

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(null);

  // Modal states
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [assignmentType, setAssignmentType] = useState('exclusive');
  const [schedule, setSchedule] = useState({ days: [], startTime: '08:00', endTime: '17:00' });
  const [boundary, setBoundary] = useState({ amount: 500, settlementType: 'daily', notes: '' });

  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedTricycleHistory, setSelectedTricycleHistory] = useState([]);

  const [addTricycleModalVisible, setAddTricycleModalVisible] = useState(false);
  const [newTricycle, setNewTricycle] = useState({ plateNumber: '', bodyNumber: '', model: '', currentOdometer: '', codingDay: null });

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [unassignModalVisible, setUnassignModalVisible] = useState(false);
  const [tricycleToUnassign, setTricycleToUnassign] = useState(null);
  const [messageSelectionModalVisible, setMessageSelectionModalVisible] = useState(false);

  // Load token and initialize
  useEffect(() => {
    // Add proper check for db readiness
    if (db && typeof db.prepareAsync === 'function') {
      loadTokenAndFetchData();
    } else {
      console.log('Database not ready yet, waiting...');
    }
  }, [db]);

  const loadTokenAndFetchData = async () => {
    try {
      // Double check db is available
      if (!db) {
        console.error('Database is null in loadTokenAndFetchData');
        return;
      }

      const authToken = await getToken(db);
      
      if (authToken) {
        setToken(authToken);
        await fetchData(authToken);
      } else {
        console.log('No auth token found');
        setToken(null);
      }
    } catch (error) {
      console.error('❌ Error loading token:', error);
      // Set token to null to allow UI to render
      setToken(null);
    }
  };

  const fetchData = async (authToken) => {
    if (!authToken) {
      console.log('No auth token provided to fetchData');
      return;
    }
    
    try {
      dispatch(fetchOperatorData({ token: authToken, BACKEND }));
      // Also fetch sick leaves to ensure fresh data for the logged-in operator
      dispatch(fetchSickLeaves({ token: authToken, BACKEND }));
    } catch (e) {
      console.error('Error fetching operator data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    dispatch(clearErrors());
    
    if (token) {
      await fetchData(token);
    } else if (db) {
      await loadTokenAndFetchData();
    } else {
      console.log('Cannot refresh: db not available');
      setRefreshing(false);
    }
  };

  const handleAssignDriver = async (tricycleId, driverId) => {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    // Validate schedule for shared assignment
    if (assignmentType === 'shared') {
      const scheduleErrors = validateSchedule(schedule);
      if (scheduleErrors.length > 0) {
        Alert.alert('Validation Error', scheduleErrors.join('\n'));
        return;
      }
    }

    const payload = { tricycleId, driverId, boundary };
    if (assignmentType === 'shared') {
      payload.schedule = schedule;
    }

    dispatch(assignDriver({ token, BACKEND, payload }));
    setAssignModalVisible(false);
    
    // Reset schedule and boundary
    setSchedule({ days: [], startTime: '08:00', endTime: '17:00' });
    setBoundary({ amount: 500, settlementType: 'daily', notes: '' });
  };

  const handleUnassignDriver = async (tricycle) => {
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
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    dispatch(unassignDriver({ token, BACKEND, tricycleId, driverId }));
    setUnassignModalVisible(false);
  };

  const handleCreateTricycle = async (tricycleDataWithDocs = null) => {
    // Use provided data with documents or fall back to newTricycle state
    const dataToSubmit = tricycleDataWithDocs || newTricycle;
    
    // Validate input
    const validationErrors = validateTricycleData(dataToSubmit);
    if (validationErrors.length > 0) {
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    dispatch(createTricycle({ token, BACKEND, tricycleData: dataToSubmit }));
    
    // Close modal and reset form
    setAddTricycleModalVisible(false);
    setNewTricycle({ plateNumber: '', bodyNumber: '', model: '', currentOdometer: '', codingDay: null });
  };

  const openMessage = (tricycle) => {
    // Check if tricycle has shared schedules (multiple scheduled drivers)
    // If schedules exist, show selection modal even if there's a driver set
    if (tricycle.schedules && tricycle.schedules.length > 0) {
      // For shared schedules, always show selection modal
      setSelectedTricycle(tricycle);
      setMessageSelectionModalVisible(true);
      return;
    }

    // For exclusive/primary driver assignment (no schedules)
    if (tricycle.driver) {
      navigation.navigate('Chat', {
        userId: tricycle.driver._id || tricycle.driver.id,
        userName: `${tricycle.driver.firstname} ${tricycle.driver.lastname}`,
        userImage: tricycle.driver.image?.url
      });
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

  const handleFetchSickLeaves = () => {
    if (token) {
      dispatch(fetchSickLeaves({ token, BACKEND }));
    }
  };

  const handleApproveSickLeave = (id) => {
    if (token) {
      dispatch(approveSickLeave({ token, BACKEND, id })).then(() => {
        dispatch(fetchSickLeaves({ token, BACKEND }));
      });
    }
  };

  const handleRejectSickLeave = (id, rejectionReason) => {
    if (token) {
      dispatch(rejectSickLeave({ token, BACKEND, id, rejectionReason })).then(() => {
        dispatch(fetchSickLeaves({ token, BACKEND }));
      });
    }
  };

  // Show loading screen while database or token is being initialized
  if (!db || (loading && !refreshing)) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Tab.Navigator
        initialRouteName="Overview"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            switch (route.name) {
              case 'Overview':
                iconName = focused ? 'grid' : 'grid-outline';
                break;
              case 'Drivers':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'Sick Leave':
                iconName = focused ? 'medical' : 'medical-outline';
                break;
              case 'Forums':
                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                break;
              default:
                iconName = 'help-circle-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: 'gray',
          tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
          tabBarStyle: { 
            backgroundColor: 'white',
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
          },
        })}
      >
        <Tab.Screen 

          name="Overview"
          options={{ headerShown: false }}
        >
          {() => (
            <OverviewTab
              loading={loading}
              refreshing={refreshing}
              error={error}
              tricycles={tricycles}
              onRefresh={onRefresh}
              onAddTricycle={() => setAddTricycleModalVisible(true)}
              onOpenAssignModal={openAssignModal}
              onUnassignDriver={handleUnassignDriver}
              onOpenMessage={openMessage}
              onOpenMaintenance={openMaintenanceModal}
              onOpenDetails={openDetailsModal}
            />
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Drivers"
          options={{ headerShown: false }}
        >
          {() => (
            <DriversTab 
              availableDrivers={availableDrivers} 
              allDrivers={drivers}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Sick Leave"
          options={{ headerShown: false }}
        >
          {() => (
            <SickLeaveTab 
              sickLeaves={sickLeaves}
              loadingSickLeaves={loadingSickLeaves}
              errorSickLeaves={operatorState.errorSickLeaves}
              onRefresh={handleFetchSickLeaves}
              onApprove={handleApproveSickLeave}
              onReject={handleRejectSickLeave}
              statistics={sickLeaveStatistics}
            />
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Complaints"
          options={{ 
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="warning-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <DriverComplaintsTab token={token} BACKEND={BACKEND} />}
        </Tab.Screen>
        <Tab.Screen 
          name="Maintenance"
          options={{ 
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="construct-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <MaintenanceApprovalTab token={token} BACKEND={BACKEND} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Modals */}
      <AddTricycleModal
        visible={addTricycleModalVisible}
        onClose={() => {
          setAddTricycleModalVisible(false);
          setNewTricycle({ plateNumber: '', bodyNumber: '', model: '', currentOdometer: '', codingDay: null });
        }}
        onSubmit={handleCreateTricycle}
        newTricycle={newTricycle}
        setNewTricycle={setNewTricycle}
        creating={creating}
        token={token}
        BACKEND={BACKEND}
      />

      <AssignDriverModal
        visible={assignModalVisible}
        onClose={() => {
          setAssignModalVisible(false);
          // Reset schedule and boundary when closing
          setSchedule({ days: [], startTime: '08:00', endTime: '17:00' });
          setBoundary({ amount: 500, settlementType: 'daily', notes: '' });
        }}
        onSubmit={handleAssignDriver}
        availableDrivers={availableDrivers}
        selectedTricycle={selectedTricycle}
        assigning={assigning}
        assignmentType={assignmentType}
        setAssignmentType={setAssignmentType}
        schedule={schedule}
        setSchedule={setSchedule}
        boundary={boundary}
        setBoundary={setBoundary}
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