import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import TricycleListItem from '../TricycleListItem';
import ErrorDisplay from '../../../components/common/ErrorDisplay';
import EmptyState from '../../../components/common/EmptyState';
import LoadingScreen from '../../../components/common/LoadingScreen';
import styles from '../operatorStyles';

export default function OverviewTab({
  loading,
  refreshing,
  error,
  tricycles,
  onRefresh,
  onAddTricycle,
  onOpenAssignModal,
  onUnassignDriver,
  onOpenMessage,
  onOpenMaintenance,
  onOpenDetails
}) {
  if (loading && !refreshing) return <LoadingScreen />;
  
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
            onPress={onAddTricycle}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {error && <ErrorDisplay error={error} onRetry={onRefresh} />}

      <FlatList
        data={tricycles}
        keyExtractor={(item) => item.id || item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TricycleListItem
            tricycle={item}
            onAssign={onOpenAssignModal}
            onUnassign={onUnassignDriver}
            onMessage={onOpenMessage}
            onMaintenance={onOpenMaintenance}
            onDetails={onOpenDetails}
          />
        )}
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="car-outline"
              title="No tricycles yet"
              subtitle="Tap the + button to add a tricycle"
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}