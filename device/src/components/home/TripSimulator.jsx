/**
 * TripSimulator.jsx - Trip Simulation Component for Testing
 * 
 * This component provides a simulation feature for testing the booking/maps system
 * without actual traveling. It simulates a trip from pickup to destination,
 * updates the odometer, and allows trip completion in testing scenarios.
 * 
 * Features:
 * - Simulates GPS movement along a route
 * - Updates odometer based on simulated distance
 * - Configurable simulation speed (1x, 2x, 4x, 8x)
 * - Visual progress indicator
 * - Can be triggered from active bookings
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../common/theme';

const KM_KEY = 'vehicle_current_km_v1';
const SIMULATION_ACTIVE_KEY = 'trip_simulation_active_v1';

// Generate intermediate points between two coordinates (straight line)
function interpolateCoordinates(start, end, numPoints = 20) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    points.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio,
      longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      timestamp: Date.now() + (i * 3000), // 3 seconds between each point
    });
  }
  return points;
}

// Interpolate additional points along an existing route for smoother animation
function interpolateRoutePoints(routeCoords, targetPoints = 60) {
  if (!routeCoords || routeCoords.length < 2) return routeCoords;
  
  // Calculate total route distance
  let totalDistance = 0;
  const distances = [0];
  for (let i = 1; i < routeCoords.length; i++) {
    const d = haversineMeters(routeCoords[i - 1], routeCoords[i]);
    totalDistance += d;
    distances.push(totalDistance);
  }
  
  if (totalDistance === 0) return routeCoords;
  
  // Generate evenly spaced points along the route
  const points = [];
  const segmentDistance = totalDistance / (targetPoints - 1);
  
  for (let i = 0; i < targetPoints; i++) {
    const targetDist = i * segmentDistance;
    
    // Find which segment this distance falls into
    let segmentIndex = 0;
    for (let j = 1; j < distances.length; j++) {
      if (distances[j] >= targetDist) {
        segmentIndex = j - 1;
        break;
      }
      segmentIndex = j - 1;
    }
    
    // Interpolate within the segment
    const segmentStart = routeCoords[segmentIndex];
    const segmentEnd = routeCoords[Math.min(segmentIndex + 1, routeCoords.length - 1)];
    const segmentLength = distances[segmentIndex + 1] - distances[segmentIndex];
    
    let ratio = 0;
    if (segmentLength > 0) {
      ratio = (targetDist - distances[segmentIndex]) / segmentLength;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    
    points.push({
      latitude: segmentStart.latitude + (segmentEnd.latitude - segmentStart.latitude) * ratio,
      longitude: segmentStart.longitude + (segmentEnd.longitude - segmentStart.longitude) * ratio,
      timestamp: Date.now() + (i * 2000), // 2 seconds between each point
    });
  }
  
  return points;
}

// Calculate distance between two coordinates in meters
function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(a.latitude), φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const aa = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
             Math.cos(φ1) * Math.cos(φ2) *
             Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R * c;
}

// Calculate total distance of a route
function calculateRouteDistance(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineMeters(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

export default function TripSimulator({
  visible,
  onClose,
  pickup,
  destination,
  bookingId,
  routeCoordinates, // Actual road route from routing API
  onSimulationStart,
  onSimulationComplete,
  onPositionUpdate,
  onOdometerUpdate,
}) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const simulationRef = useRef(null);
  const routePointsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Reset simulation when modal opens
  useEffect(() => {
    if (visible && pickup && destination) {
      // Use actual road route if available, otherwise generate straight-line interpolation
      let route;
      if (routeCoordinates && routeCoordinates.length > 2) {
        // Use the actual road route - add more intermediate points for smoother animation
        route = interpolateRoutePoints(routeCoordinates, 60);
      } else {
        // Fallback to straight-line interpolation
        route = interpolateCoordinates(pickup, destination, 30);
      }
      routePointsRef.current = route;
      
      // Calculate total distance
      const distance = calculateRouteDistance(route);
      setTotalDistance(distance);
      
      // Estimate time at 25 km/h average speed
      const timeSeconds = (distance / 1000) / 25 * 3600;
      setEstimatedTime(Math.round(timeSeconds));
      
      // Reset state
      setSimulationProgress(0);
      setDistanceTraveled(0);
      setCurrentPosition(pickup);
      setIsSimulating(false);
      setIsPaused(false);
      currentIndexRef.current = 0;
      progressAnim.setValue(0);
    }
  }, [visible, pickup, destination, routeCoordinates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current);
      }
    };
  }, []);

  const startSimulation = async () => {
    if (!pickup || !destination) {
      Alert.alert('Error', 'Missing pickup or destination coordinates');
      return;
    }

    Alert.alert(
      '🧪 Start Trip Simulation',
      `This will simulate traveling ${(totalDistance / 1000).toFixed(2)} km from pickup to destination.\n\nThe tricycle icon will follow the route on the map.\n\nThe odometer will be updated based on simulated distance.\n\nSpeed: ${simulationSpeed}x`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Simulation',
          onPress: () => {
            setIsSimulating(true);
            setIsPaused(false);
            pausedRef.current = false;
            currentIndexRef.current = 0;
            setDistanceTraveled(0);
            
            // Notify parent that simulation started
            if (onSimulationStart) {
              onSimulationStart();
            }
            
            // Save simulation state
            AsyncStorage.setItem(SIMULATION_ACTIVE_KEY, JSON.stringify({
              bookingId,
              startTime: Date.now(),
              pickup,
              destination,
            }));
            
            // Start the simulation loop
            simulateNextPoint();
          },
        },
      ]
    );
  };

  const simulateNextPoint = useCallback(() => {
    if (pausedRef.current) {
      return;
    }

    const route = routePointsRef.current;
    const index = currentIndexRef.current;

    if (index >= route.length) {
      // Simulation complete
      completeSimulation();
      return;
    }

    const currentPoint = route[index];
    const progress = index / (route.length - 1);
    
    // Update position
    setCurrentPosition(currentPoint);
    setSimulationProgress(progress);
    
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300 / speedRef.current,
      useNativeDriver: false,
    }).start();

    // Calculate distance traveled so far
    if (index > 0) {
      const segmentDistance = haversineMeters(route[index - 1], currentPoint);
      setDistanceTraveled(prev => {
        const newDistance = prev + segmentDistance;
        
        // Update odometer
        updateOdometer(segmentDistance);
        
        return newDistance;
      });
    }

    // Notify parent of position update
    if (onPositionUpdate) {
      onPositionUpdate(currentPoint, progress);
    }

    // Schedule next point
    currentIndexRef.current = index + 1;
    const baseDelay = 1000; // 1 second between points
    const delay = baseDelay / speedRef.current;
    
    simulationRef.current = setTimeout(simulateNextPoint, delay);
  }, []);

  const updateOdometer = async (distanceMeters) => {
    try {
      const storedKm = await AsyncStorage.getItem(KM_KEY);
      const currentKm = storedKm ? parseFloat(storedKm) : 0;
      const newKm = currentKm + (distanceMeters / 1000);
      
      await AsyncStorage.setItem(KM_KEY, String(Math.round(newKm * 100) / 100));
      
      if (onOdometerUpdate) {
        onOdometerUpdate(newKm);
      }
    } catch (error) {
      console.error('Error updating odometer:', error);
    }
  };

  const completeSimulation = async () => {
    setIsSimulating(false);
    setSimulationProgress(1);
    
    // Clean up simulation state
    await AsyncStorage.removeItem(SIMULATION_ACTIVE_KEY);

    Alert.alert(
      '✅ Simulation Complete!',
      `Trip simulated successfully!\n\nDistance: ${(distanceTraveled / 1000).toFixed(2)} km\nOdometer updated.\n\nYou can now complete the trip.`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (onSimulationComplete) {
              onSimulationComplete({
                distanceTraveled,
                finalPosition: destination,
                bookingId,
              });
            }
            onClose();
          },
        },
      ]
    );
  };

  const pauseSimulation = () => {
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
    pausedRef.current = true;
    setIsPaused(true);
  };

  const resumeSimulation = () => {
    pausedRef.current = false;
    setIsPaused(false);
    simulateNextPoint();
  };

  const stopSimulation = () => {
    Alert.alert(
      'Stop Simulation',
      'Are you sure you want to stop the simulation? Progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            if (simulationRef.current) {
              clearTimeout(simulationRef.current);
            }
            setIsSimulating(false);
            setSimulationProgress(0);
            setDistanceTraveled(0);
            setCurrentPosition(null);
            currentIndexRef.current = 0;
            progressAnim.setValue(0);
            await AsyncStorage.removeItem(SIMULATION_ACTIVE_KEY);
            // Notify parent to clear simulation state
            if (onPositionUpdate) {
              onPositionUpdate(null, 0);
            }
          },
        },
      ]
    );
  };

  const changeSpeed = (speed) => {
    setSimulationSpeed(speed);
    speedRef.current = speed;
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="flask" size={24} color={colors.primary} />
              <Text style={styles.title}>Trip Simulator</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.orangeShade6} />
            </TouchableOpacity>
          </View>

          {/* Simulation Info */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="navigate" size={20} color="#28a745" />
                <Text style={styles.infoLabel}>Total Distance</Text>
                <Text style={styles.infoValue}>{(totalDistance / 1000).toFixed(2)} km</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time" size={20} color="#17a2b8" />
                <Text style={styles.infoLabel}>Est. Time</Text>
                <Text style={styles.infoValue}>{formatTime(Math.round(estimatedTime / simulationSpeed))}</Text>
              </View>
            </View>
            
            {isSimulating && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Simulation Progress</Text>
                  <Text style={styles.progressPercent}>{Math.round(simulationProgress * 100)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressStats}>
                  <Text style={styles.progressStat}>
                    <Ionicons name="speedometer" size={12} /> {(distanceTraveled / 1000).toFixed(2)} km traveled
                  </Text>
                  <Text style={styles.progressStat}>
                    <Ionicons name="location" size={12} /> {currentPosition ? `${currentPosition.latitude.toFixed(5)}, ${currentPosition.longitude.toFixed(5)}` : 'N/A'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Speed Controls */}
          <View style={styles.speedSection}>
            <Text style={styles.speedLabel}>Simulation Speed:</Text>
            <View style={styles.speedButtons}>
              {[1, 2, 4, 8].map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedBtn,
                    simulationSpeed === speed && styles.speedBtnActive,
                  ]}
                  onPress={() => changeSpeed(speed)}
                  disabled={isSimulating && !isPaused}
                >
                  <Text style={[
                    styles.speedBtnText,
                    simulationSpeed === speed && styles.speedBtnTextActive,
                  ]}>
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {!isSimulating ? (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={startSimulation}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.startBtnText}>Start Simulation</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.simulatingActions}>
                {isPaused ? (
                  <TouchableOpacity
                    style={styles.resumeBtn}
                    onPress={resumeSimulation}
                  >
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Resume</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.pauseBtn}
                    onPress={pauseSimulation}
                  >
                    <Ionicons name="pause" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Pause</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={stopSimulation}
                >
                  <Ionicons name="stop" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Warning */}
          <View style={styles.warningSection}>
            <Ionicons name="information-circle" size={18} color="#856404" />
            <Text style={styles.warningText}>
              This is a testing feature. The simulation will update the odometer and allow trip completion without physical travel.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.large,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginLeft: spacing.small,
  },
  closeBtn: {
    padding: 4,
  },
  infoSection: {
    backgroundColor: colors.ivory2,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  progressSection: {
    marginTop: spacing.medium,
    paddingTop: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressTrack: {
    height: 12,
    backgroundColor: colors.ivory3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressStats: {
    marginTop: 8,
    gap: 4,
  },
  progressStat: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  speedSection: {
    marginBottom: spacing.medium,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: 8,
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.ivory2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  speedBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  speedBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
  },
  speedBtnTextActive: {
    color: '#fff',
  },
  actions: {
    marginBottom: spacing.medium,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  simulatingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffc107',
    paddingVertical: 14,
    borderRadius: 10,
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
  },
  stopBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
});
