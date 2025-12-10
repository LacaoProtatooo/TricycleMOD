import { Alert } from 'react-native';

export const fetchOperatorData = async (authToken, BACKEND) => {
  try {
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
      return data;
    } else {
      throw new Error(data.message || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Error fetching operator data:', error);
    throw error;
  }
};

export const handleAssignDriver = async (token, BACKEND, payload) => {
  try {
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
      return { success: true };
    } else {
      Alert.alert('Error', data.message || 'Failed to assign driver');
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Error assigning driver:', error);
    Alert.alert('Error', 'Failed to assign driver. Please try again.');
    return { success: false, error: error.message };
  }
};

export const handleUnassignDriver = async (token, BACKEND, { tricycleId, driverId }) => {
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
      return { success: true };
    } else {
      Alert.alert('Error', data.message || 'Failed to unassign driver');
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Error unassigning driver:', error);
    Alert.alert('Error', 'Failed to unassign driver. Please try again.');
    return { success: false, error: error.message };
  }
};

export const handleCreateTricycle = async (token, BACKEND, tricycleData) => {
  try {
    const res = await fetch(`${BACKEND}/api/tricycles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        plateNumber: tricycleData.plateNumber,
        model: tricycleData.model,
        status: 'unavailable',
        currentOdometer: tricycleData.currentOdometer ? parseFloat(tricycleData.currentOdometer) : 0,
      }),
    });

    const data = await res.json();
    if (data.success) {
      Alert.alert('Success', 'Tricycle added successfully');
      return { success: true };
    } else {
      Alert.alert('Error', data.message || 'Failed to create tricycle');
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Error creating tricycle:', error);
    Alert.alert('Error', 'Failed to create tricycle. Please try again.');
    return { success: false, error: error.message };
  }
};