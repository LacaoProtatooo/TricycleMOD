import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;

const LeaderboardTab = () => {
  const db = useAsyncSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState(null);
  const [userRank, setUserRank] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'allTime'
  const [token, setToken] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (db) {
        const t = await getToken(db);
        setToken(t);
      }
    };
    init();
  }, [db]);

  useEffect(() => {
    if (token) {
      fetchAvailableMonths();
      fetchLeaderboard();
    }
  }, [token, viewMode, selectedMonth, selectedYear]);

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/leaderboard/months`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setAvailableMonths(json.data || []);
      }
    } catch (e) {
      console.warn('Error fetching months:', e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      let url = `${BACKEND}/api/leaderboard`;
      
      if (viewMode === 'allTime') {
        url = `${BACKEND}/api/leaderboard/all-time`;
      } else if (selectedMonth && selectedYear) {
        url = `${BACKEND}/api/leaderboard?month=${selectedMonth}&year=${selectedYear}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (json.success) {
        setLeaderboard(json.data.leaderboard || []);
        setPeriod(json.data.period || null);
        setUserRank(json.data.userRank || null);
      }
    } catch (e) {
      console.warn('Error fetching leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [token, viewMode, selectedMonth, selectedYear]);

  const getRankIcon = (rank) => {
    if (rank === 1) return { icon: 'trophy', color: '#FFD700' };
    if (rank === 2) return { icon: 'medal', color: '#C0C0C0' };
    if (rank === 3) return { icon: 'medal', color: '#CD7F32' };
    return null;
  };

  const getRankBgColor = (rank) => {
    if (rank === 1) return 'rgba(255, 215, 0, 0.15)';
    if (rank === 2) return 'rgba(192, 192, 192, 0.15)';
    if (rank === 3) return 'rgba(205, 127, 50, 0.15)';
    return colors.ivory4;
  };

  const renderDriverItem = (driver, index) => {
    const rankInfo = getRankIcon(driver.rank);
    
    return (
      <View 
        key={driver.driverId} 
        style={[styles.driverCard, { backgroundColor: getRankBgColor(driver.rank) }]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          {rankInfo ? (
            <Ionicons name={rankInfo.icon} size={28} color={rankInfo.color} />
          ) : (
            <Text style={styles.rankNumber}>{driver.rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {driver.image?.url ? (
            <Image source={{ uri: driver.image.url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={colors.gray1} />
            </View>
          )}
        </View>

        {/* Driver Info */}
        <View style={styles.driverInfo}>
          <Text style={styles.driverName} numberOfLines={1}>
            {driver.firstname} {driver.lastname}
          </Text>
          <Text style={styles.driverUsername}>@{driver.username}</Text>
          {driver.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={styles.ratingText}>{driver.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Trip Count */}
        <View style={styles.tripCountContainer}>
          <Text style={styles.tripCount}>
            {viewMode === 'allTime' ? driver.totalTrips : driver.monthlyTrips}
          </Text>
          <Text style={styles.tripLabel}>trips</Text>
        </View>
      </View>
    );
  };

  const renderMonthSelector = () => {
    const currentDate = new Date();
    const months = [
      { month: currentDate.getMonth() + 1, year: currentDate.getFullYear(), label: 'This Month' },
      ...availableMonths.slice(0, 5).map(m => ({
        month: m.month,
        year: m.year,
        label: `${m.monthName} ${m.year}`
      }))
    ];

    // Remove duplicates
    const uniqueMonths = months.filter((m, i, arr) => 
      arr.findIndex(x => x.month === m.month && x.year === m.year) === i
    );

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.monthScroll}
        contentContainerStyle={styles.monthScrollContent}
      >
        {uniqueMonths.map((m, idx) => {
          const isSelected = viewMode === 'monthly' && 
            (selectedMonth === m.month && selectedYear === m.year) ||
            (!selectedMonth && idx === 0);
          
          return (
            <TouchableOpacity
              key={`${m.month}-${m.year}`}
              style={[styles.monthPill, isSelected && styles.monthPillActive]}
              onPress={() => {
                setViewMode('monthly');
                setSelectedMonth(m.month);
                setSelectedYear(m.year);
              }}
            >
              <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.monthPill, viewMode === 'allTime' && styles.monthPillActive]}
          onPress={() => setViewMode('allTime')}
        >
          <Text style={[styles.monthPillText, viewMode === 'allTime' && styles.monthPillTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="trophy" size={28} color={colors.orangeShade7} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {viewMode === 'allTime' ? 'All-Time Rankings' : period?.monthName ? `${period.monthName} ${period.year}` : 'Monthly Rankings'}
        </Text>
      </View>

      {/* Month Selector */}
      {renderMonthSelector()}

      {/* User's Rank Card */}
      {userRank && (
        <View style={styles.userRankCard}>
          <Ionicons name="person-circle" size={24} color={colors.orangeShade7} />
          <View style={styles.userRankInfo}>
            <Text style={styles.userRankLabel}>Your Ranking</Text>
            <Text style={styles.userRankText}>
              #{userRank.rank} • {viewMode === 'allTime' ? userRank.totalTrips : userRank.monthlyTrips} trips
            </Text>
          </View>
        </View>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.orangeShade7} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orangeShade7]} />
          }
        >
          {leaderboard.length > 0 ? (
            leaderboard.map((driver, idx) => renderDriverItem(driver, idx))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color={colors.gray1} />
              <Text style={styles.emptyTitle}>No Data Yet</Text>
              <Text style={styles.emptyText}>
                {viewMode === 'allTime' 
                  ? 'No drivers have completed trips yet.' 
                  : 'No trips completed this month yet.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  header: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    backgroundColor: colors.ivory1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.brownShade2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray1,
    marginTop: 4,
    marginLeft: 38,
  },
  monthScroll: {
    maxHeight: 50,
    backgroundColor: colors.ivory2,
  },
  monthScrollContent: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    gap: 8,
    flexDirection: 'row',
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.ivory4,
    marginRight: 8,
  },
  monthPillActive: {
    backgroundColor: colors.orangeShade7,
  },
  monthPillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.brownShade2,
  },
  monthPillTextActive: {
    color: '#fff',
  },
  userRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orangeShade1,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    padding: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orangeShade3,
    gap: 12,
  },
  userRankInfo: {
    flex: 1,
  },
  userRankLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.orangeShade7,
  },
  userRankText: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.brownShade2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray1,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: spacing.medium,
    paddingBottom: 100,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.brownShade2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.brownShade2,
  },
  driverUsername: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gray1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.gray1,
  },
  tripCountContainer: {
    alignItems: 'center',
    backgroundColor: colors.orangeShade2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tripCount: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.orangeShade7,
  },
  tripLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.orangeShade6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.brownShade2,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray1,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default LeaderboardTab;
