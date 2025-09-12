import { Image } from 'expo-image';
import { Platform, StyleSheet, View, TextInput, Pressable } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/main/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useMemo, useState } from 'react';

export default function HomeScreen() {
  const { selectedMotorcycle, odometerKm, maintenanceTasks, maintenanceRecords, addKilometers, markServiced } = useAuth();
  const colorScheme = useColorScheme();
  const [kmToAdd, setKmToAdd] = useState<string>('');

  const taskStatuses = useMemo(() => {
    return maintenanceTasks.map((task) => {
      const last = maintenanceRecords[task.key]?.lastServicedKm ?? 0;
      const since = Math.max(0, odometerKm - last);
      const remaining = Math.max(0, task.intervalKm - since);
      const due = remaining === 0;
      const overdueAmount = Math.max(0, since - task.intervalKm);
      const progress = Math.min(1, since / task.intervalKm);
      return { task, last, since, remaining, due, overdueAmount, progress };
    });
  }, [maintenanceTasks, maintenanceRecords, odometerKm]);

  function handleAddKm() {
    const parsed = parseInt(kmToAdd, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      addKilometers(parsed);
      setKmToAdd('');
    }
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#FFE8D6', dark: '#2B1B0F' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Dashboard</ThemedText>
        <HelloWave />
      </ThemedView>
      {selectedMotorcycle && (
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Your motorcycle</ThemedText>
          <ThemedText style={{ color: Colors[colorScheme ?? 'light'].tint, fontWeight: '700' }}>
            {selectedMotorcycle}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Odometer</ThemedText>
        <ThemedText style={styles.odometerText}>{odometerKm} km</ThemedText>
        <View style={styles.addKmRow}>
          <TextInput
            placeholder="Add kilometers"
            keyboardType="numeric"
            value={kmToAdd}
            onChangeText={setKmToAdd}
            style={styles.input}
          />
          <Pressable onPress={handleAddKm} style={[styles.addButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Maintenance</ThemedText>
        {taskStatuses.map(({ task, remaining, due, overdueAmount, progress, since }) => (
          <View key={task.key} style={styles.maintenanceItem}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.maintenanceTitle}>{task.title}</ThemedText>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                        backgroundColor: due ? '#D32F2F' : Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.progressText}>{Math.round(progress * 100)}%</ThemedText>
              </View>
              {due ? (
                <ThemedText style={{ color: '#D32F2F', fontWeight: '600' }}>
                  Due now {overdueAmount > 0 ? `(over by ${overdueAmount} km)` : ''}
                </ThemedText>
              ) : (
                <ThemedText style={{ opacity: 0.8 }}>{remaining} km remaining • {since}/{task.intervalKm} km</ThemedText>
              )}
            </View>
            <Pressable
              onPress={() => markServiced(task.key)}
              style={[styles.serviceButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}
            >
              <ThemedText style={[styles.serviceButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Mark serviced</ThemedText>
            </Pressable>
          </View>
        ))}
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Tips</ThemedText>
        <ThemedText>
          Keep your tricycle running smoothly by following the maintenance intervals. Update the odometer after every pasada.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    gap: 8,
    marginBottom: 12,
  },
  odometerText: {
    fontSize: 24,
    fontWeight: '700',
  },
  addKmRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  maintenanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  maintenanceTitle: {
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  progressText: {
    width: 48,
    textAlign: 'right',
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
