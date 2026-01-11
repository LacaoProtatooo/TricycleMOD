/**
 * BoundarySettlementsScreen.jsx - Operator's Boundary Settlement Management
 * 
 * Features:
 * - View all pending settlements awaiting confirmation
 * - Confirm or dispute driver payments
 * - View settlement history
 * - Summary of expected income
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';

import { colors, spacing } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';

const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';

const BoundarySettlementsScreen = ({ navigation }) => {
  const db = useAsyncSQLiteContext();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'history', 'tricycles'
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, [db]);

  const initializeScreen = async () => {
    try {
      if (db) {
        const token = await getToken(db);
        if (token) {
          setAuthToken(token);
          await fetchOverview(token);
        }
      }
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async (token) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/boundary/operator-overview`, {
        headers: { Authorization: `Bearer ${token || authToken}` }
      });
      setOverviewData(response.data);
    } catch (error) {
      console.error('Error fetching overview:', error);
      Alert.alert('Error', 'Failed to load settlement data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    setRefreshing(false);
  };

  const handleConfirmSettlement = async (settlementId) => {
    try {
      setConfirmingId(settlementId);
      const response = await axios.put(
        `${BACKEND_URL}/api/boundary/confirm/${settlementId}`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        Alert.alert('Confirmed!', 'Settlement has been confirmed.');
        await fetchOverview();
      }
    } catch (error) {
      console.error('Error confirming:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to confirm');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDisputeSettlement = (settlementId) => {
    Alert.prompt(
      'Dispute Settlement',
      'Enter reason for dispute:',
      async (reason) => {
        if (!reason) return;
        try {
          const response = await axios.put(
            `${BACKEND_URL}/api/boundary/dispute/${settlementId}`,
            { reason },
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          if (response.data.success) {
            Alert.alert('Disputed', 'Settlement has been marked as disputed.');
            await fetchOverview();
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to dispute settlement');
        }
      },
      'plain-text'
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderSettlementItem = ({ item }) => (
    <View style={styles.settlementCard}>
      <View style={styles.settlementHeader}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.driverName}>
              {item.driver?.firstname} {item.driver?.lastname}
            </Text>
            <Text style={styles.tricycleInfo}>
              {item.tricycle?.plateNumber} {item.tricycle?.bodyNumber ? `(${item.tricycle.bodyNumber})` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.settlementAmount}>₱{item.amount}</Text>
      </View>

      <View style={styles.settlementDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{formatDate(item.paidAt || item.createdAt)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            {item.paymentMethod === 'cash' ? 'Cash' : item.paymentMethod === 'gcash' ? 'GCash' : 'Bank Transfer'}
          </Text>
        </View>
        {item.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={14} color="#666" />
            <Text style={styles.detailText} numberOfLines={2}>{item.notes}</Text>
          </View>
        )}
      </View>

      {item.status === 'paid' && (
        <View style={styles.settlementActions}>
          <TouchableOpacity
            style={[styles.confirmBtn, confirmingId === item._id && { opacity: 0.7 }]}
            onPress={() => handleConfirmSettlement(item._id)}
            disabled={confirmingId === item._id}
          >
            {confirmingId === item._id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => handleDisputeSettlement(item._id)}
          >
            <Ionicons name="alert-circle" size={18} color="#dc3545" />
            <Text style={styles.disputeBtnText}>Dispute</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'confirmed' && (
        <View style={styles.confirmedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#28a745" />
          <Text style={styles.confirmedText}>Confirmed {formatDate(item.confirmedAt)}</Text>
        </View>
      )}
    </View>
  );

  const renderTricycleItem = ({ item }) => (
    <View style={styles.tricycleCard}>
      <View style={styles.tricycleHeader}>
        <View>
          <Text style={styles.tricyclePlate}>{item.plateNumber}</Text>
          {item.bodyNumber && <Text style={styles.tricycleBody}>Body #{item.bodyNumber}</Text>}
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.driver ? '#d4edda' : '#f8d7da' }
        ]}>
          <Text style={{ fontSize: 11, color: item.driver ? '#155724' : '#721c24' }}>
            {item.driver ? 'Assigned' : 'Unassigned'}
          </Text>
        </View>
      </View>

      {item.driver && (
        <View style={styles.tricycleDriver}>
          <Ionicons name="person-circle" size={20} color={colors.primary} />
          <Text style={styles.tricycleDriverName}>
            {item.driver.firstname} {item.driver.lastname}
          </Text>
        </View>
      )}

      {item.boundary?.amount > 0 && (
        <View style={styles.tricycleBoundary}>
          <Ionicons name="cash" size={16} color="#28a745" />
          <Text style={styles.tricycleBoundaryText}>
            ₱{item.boundary.amount} / {item.boundary.settlementType || 'daily'}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.orangeShade7} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Boundary Settlements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary Cards */}
      {overviewData?.summary && (
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: '#cce5ff' }]}>
            <Text style={styles.summaryLabel}>Pending Confirmation</Text>
            <Text style={[styles.summaryValue, { color: '#004085' }]}>
              ₱{overviewData.summary.totalPendingConfirmation}
            </Text>
            <Text style={styles.summaryCount}>
              {overviewData.summary.pendingConfirmationCount} payments
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#d4edda' }]}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={[styles.summaryValue, { color: '#155724' }]}>
              ₱{overviewData.summary.totalConfirmedThisMonth}
            </Text>
            <Text style={styles.summaryCount}>confirmed</Text>
          </View>
        </View>
      )}

      {/* Expected Income */}
      {overviewData?.summary && (
        <View style={styles.expectedIncome}>
          <Ionicons name="trending-up" size={18} color="#28a745" />
          <Text style={styles.expectedLabel}>Expected:</Text>
          <Text style={styles.expectedValue}>
            ₱{overviewData.summary.expectedDailyIncome}/day • ₱{overviewData.summary.expectedWeeklyIncome}/week
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending ({overviewData?.pendingSettlements?.filter(s => s.status === 'paid').length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tricycles' && styles.tabActive]}
          onPress={() => setActiveTab('tricycles')}
        >
          <Text style={[styles.tabText, activeTab === 'tricycles' && styles.tabTextActive]}>
            Tricycles ({overviewData?.tricycles?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'pending' && (
        <FlatList
          data={overviewData?.pendingSettlements?.filter(s => s.status === 'paid') || []}
          renderItem={renderSettlementItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No pending settlements</Text>
              <Text style={styles.emptySubtext}>All driver payments have been confirmed</Text>
            </View>
          }
        />
      )}

      {activeTab === 'history' && (
        <FlatList
          data={overviewData?.recentSettlements || []}
          renderItem={renderSettlementItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No settlement history</Text>
            </View>
          }
        />
      )}

      {activeTab === 'tricycles' && (
        <FlatList
          data={overviewData?.tricycles || []}
          renderItem={renderTricycleItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No tricycles</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1 || '#FFFEF7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },

  // Summary
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryCount: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },

  // Expected Income
  expectedIncome: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  expectedLabel: {
    fontSize: 13,
    color: '#666',
  },
  expectedValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#28a745',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Settlement Card
  settlementCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  tricycleInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  settlementAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#28a745',
  },
  settlementDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  settlementActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  disputeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    gap: 6,
  },
  disputeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc3545',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confirmedText: {
    fontSize: 12,
    color: '#28a745',
  },

  // Tricycle Card
  tricycleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tricycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tricyclePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  tricycleBody: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tricycleDriver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tricycleDriverName: {
    fontSize: 14,
    color: '#333',
  },
  tricycleBoundary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tricycleBoundaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});

export default BoundarySettlementsScreen;
