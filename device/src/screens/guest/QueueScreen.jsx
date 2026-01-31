/**
 * QueueScreen.jsx - Guest Queue Viewing Screen
 *
 * Allows guests to view the queue at each terminal
 * Shows how many drivers are waiting at each terminal
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../../components/common/theme';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;

const GuestQueueScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Fetch terminals
  const fetchTerminals = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/queue/public/terminals`);
      const json = await res.json();
      if (res.ok && json.success) {
        setTerminals(json.data || []);
        if (!selectedTerminal && json.data?.length > 0) {
          setSelectedTerminal(json.data[0].id);
        }
      }
    } catch (error) {
      console.warn('Error fetching terminals:', error);
    }
  };

  // Fetch queue for selected terminal
  const fetchQueue = async (terminalId) => {
    if (!terminalId) return;
    setQueueLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/queue/public?terminal=${encodeURIComponent(terminalId)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setQueue(json.data || []);
      }
    } catch (error) {
      console.warn('Error fetching queue:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchTerminals();
      setLoading(false);
    };
    init();
  }, []);

  // Fetch queue when terminal changes
  useEffect(() => {
    if (selectedTerminal) {
      fetchQueue(selectedTerminal);
    }
  }, [selectedTerminal]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (selectedTerminal) {
      const interval = setInterval(() => {
        fetchQueue(selectedTerminal);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedTerminal]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTerminals();
    if (selectedTerminal) {
      await fetchQueue(selectedTerminal);
    }
    setRefreshing(false);
  }, [selectedTerminal]);

  const getQueueStatusColor = (count) => {
    if (count === 0) return '#22c55e'; // Green - no queue
    if (count <= 3) return '#f59e0b'; // Yellow - short queue
    return '#ef4444'; // Red - long queue
  };

  const getQueueStatusText = (count) => {
    if (count === 0) return 'No wait';
    if (count === 1) return '1 driver waiting';
    return `${count} drivers waiting`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading terminals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Terminal Queue</Text>
            <Text style={styles.headerSubtitle}>View waiting drivers at terminals</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Terminal Selection Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location" size={16} color={colors.orangeShade6} /> Select Terminal
          </Text>
          <View style={styles.terminalGrid}>
            {terminals.map((terminal) => (
              <TouchableOpacity
                key={terminal.id}
                style={[
                  styles.terminalCard,
                  selectedTerminal === terminal.id && styles.terminalCardActive,
                ]}
                onPress={() => setSelectedTerminal(terminal.id)}
              >
                <View style={styles.terminalCardContent}>
                  <Ionicons
                    name="flag"
                    size={20}
                    color={selectedTerminal === terminal.id ? '#fff' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.terminalName,
                      selectedTerminal === terminal.id && styles.terminalNameActive,
                    ]}
                  >
                    {terminal.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Queue Status Summary */}
        {selectedTerminal && (
          <View style={styles.section}>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: getQueueStatusColor(queue.length) },
                  ]}
                />
                <Text style={styles.statusTitle}>
                  {terminals.find((t) => t.id === selectedTerminal)?.name || 'Terminal'}
                </Text>
              </View>
              <View style={styles.statusBody}>
                <Text style={styles.queueCount}>{queue.length}</Text>
                <Text style={styles.queueLabel}>
                  {queue.length === 1 ? 'Driver in Queue' : 'Drivers in Queue'}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getQueueStatusColor(queue.length) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: getQueueStatusColor(queue.length) },
                    ]}
                  >
                    {getQueueStatusText(queue.length)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Queue List */}
        {selectedTerminal && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="list" size={16} color={colors.orangeShade6} /> Queue Order
            </Text>

            {queueLoading ? (
              <View style={styles.queueLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.queueLoadingText}>Loading queue...</Text>
              </View>
            ) : queue.length === 0 ? (
              <View style={styles.emptyQueue}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={styles.emptyTitle}>No Queue</Text>
                <Text style={styles.emptySubtitle}>
                  There are no drivers waiting at this terminal
                </Text>
              </View>
            ) : (
              <View style={styles.queueList}>
                {queue.map((entry, index) => (
                  <View
                    key={entry._id}
                    style={[styles.queueItem, index === 0 && styles.queueItemFirst]}
                  >
                    <View
                      style={[
                        styles.positionBadge,
                        index === 0 && styles.positionBadgeFirst,
                      ]}
                    >
                      <Text
                        style={[
                          styles.positionText,
                          index === 0 && styles.positionTextFirst,
                        ]}
                      >
                        {entry.position || index + 1}
                      </Text>
                    </View>
                    <View style={styles.queueItemInfo}>
                      <Text style={styles.bodyNumber}>{entry.bodyNumber}</Text>
                      <Text style={styles.plateNumber}>{entry.plateNumber}</Text>
                    </View>
                    {index === 0 && (
                      <View style={styles.nextBadge}>
                        <Text style={styles.nextBadgeText}>NEXT</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About Terminal Queues</Text>
              <Text style={styles.infoText}>
                Drivers line up at terminals to pick up passengers. The queue shows
                which tricycles are waiting and their order. Shorter queues mean
                faster service!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.orangeShade5,
    fontSize: 14,
  },
  header: {
    backgroundColor: colors.ivory1,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: spacing.medium,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xlarge,
  },
  section: {
    padding: spacing.medium,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: spacing.small,
  },
  terminalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  terminalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.ivory2,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  terminalCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  terminalCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  terminalName: {
    marginLeft: 8,
    fontWeight: '600',
    color: colors.orangeShade6,
    fontSize: 14,
  },
  terminalNameActive: {
    color: '#fff',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.large,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  statusBody: {
    alignItems: 'center',
  },
  queueCount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
  },
  queueLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: spacing.medium,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueLoadingContainer: {
    padding: spacing.large,
    alignItems: 'center',
  },
  queueLoadingText: {
    marginTop: 8,
    color: colors.orangeShade5,
    fontSize: 13,
  },
  emptyQueue: {
    alignItems: 'center',
    padding: spacing.xlarge,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    marginTop: spacing.medium,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#22c55e',
    marginTop: 4,
    textAlign: 'center',
  },
  queueList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    overflow: 'hidden',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory2,
  },
  queueItemFirst: {
    backgroundColor: '#fef3c7',
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ivory3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionBadgeFirst: {
    backgroundColor: colors.primary,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.orangeShade6,
  },
  positionTextFirst: {
    color: '#fff',
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: spacing.medium,
  },
  bodyNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  plateNumber: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  nextBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nextBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.ivory2,
    borderRadius: 12,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.small,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.orangeShade5,
    lineHeight: 18,
  },
});

export default GuestQueueScreen;
