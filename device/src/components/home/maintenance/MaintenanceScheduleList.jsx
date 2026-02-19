import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';
import { FALLBACK_SCHEDULE } from './maintenanceConstants';
import { getWearColor } from '../VehicleDiagnostic';

const MaintenanceScheduleList = ({
	data,
	lastServiceDates,
	skipReasons,
	odometerKm,
	currentKm,
	onMarkDone,
	onDefer,
	schedule = FALLBACK_SCHEDULE, // Accept dynamic schedule with fallback
	filter = 'all', // 'all' | 'critical' | 'attention'
	onClearFilter,
}) => {
	const progressFor = (lastKm, intervalKm) => {
		const cur = parseInt(odometerKm || currentKm || '0', 10);
		const last = parseInt(lastKm || '0', 10);
		const diff = Math.max(0, cur - last);
		const pct = Math.min(100, Math.round((diff / intervalKm) * 100));
		return pct;
	};

	// Compute overall progress for an item (max of km and time progress)
	const getOverallProgress = (item, group) => {
		const last = data[item.key] || 0;
		const kmProgress = progressFor(last, group.intervalKm);
		let timeProgress = 0;
		const lastDate = lastServiceDates[item.key];
		if (lastDate && group.baselineDays) {
			const daysSince = Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
			timeProgress = Math.min(100, Math.round((daysSince / group.baselineDays) * 100));
		}
		return Math.max(kmProgress, timeProgress);
	};

	// Filter schedule based on filter type
	const filteredSchedule = filter === 'all' 
		? schedule 
		: schedule.map(group => ({
			...group,
			items: group.items.filter(item => {
				const progress = getOverallProgress(item, group);
				if (filter === 'critical') return progress >= 80;
				if (filter === 'attention') return progress >= 60;
				return true;
			}),
		})).filter(group => group.items.length > 0);

	const filterLabel = filter === 'critical' 
		? 'Critical Items' 
		: filter === 'attention' 
		? 'Items Needing Attention' 
		: null;

	return (
		<View>
			{/* Active Filter Banner */}
			{filter !== 'all' && (
				<View style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					backgroundColor: filter === 'critical' ? '#DC262612' : '#F59E0B12',
					borderWidth: 1,
					borderColor: filter === 'critical' ? '#DC262630' : '#F59E0B30',
					borderRadius: 10,
					paddingHorizontal: 14,
					paddingVertical: 10,
					marginBottom: 12,
				}}>
					<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
						<Ionicons 
							name="funnel" 
							size={16} 
							color={filter === 'critical' ? '#DC2626' : '#F59E0B'} 
						/>
						<Text style={{ 
							fontSize: 13, 
							fontWeight: '700', 
							color: filter === 'critical' ? '#DC2626' : '#D97706',
							marginLeft: 8,
						}}>
							{filterLabel} ({filteredSchedule.reduce((sum, g) => sum + g.items.length, 0)})
						</Text>
					</View>
					{onClearFilter && (
						<TouchableOpacity 
							onPress={onClearFilter}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: colors.ivory1,
								paddingHorizontal: 10,
								paddingVertical: 5,
								borderRadius: 8,
								borderWidth: 1,
								borderColor: colors.ivory3,
							}}
						>
							<Ionicons name="close-circle" size={14} color={colors.orangeShade5} />
							<Text style={{ fontSize: 12, fontWeight: '600', color: colors.orangeShade6, marginLeft: 4 }}>
								Show All
							</Text>
						</TouchableOpacity>
					)}
				</View>
			)}

			<Text style={styles.sectionTitle}>Maintenance Schedule Details</Text>
			
			{filteredSchedule.length === 0 && filter !== 'all' ? (
				<View style={{ alignItems: 'center', paddingVertical: 30 }}>
					<Ionicons name="checkmark-circle" size={48} color="#22C55E" />
					<Text style={{ fontSize: 15, fontWeight: '700', color: '#16a34a', marginTop: 10 }}>
						No items match this filter
					</Text>
					<Text style={{ fontSize: 13, color: colors.orangeShade5, marginTop: 4, textAlign: 'center' }}>
						All maintenance items are in good condition.
					</Text>
					{onClearFilter && (
						<TouchableOpacity 
							onPress={onClearFilter}
							style={{
								marginTop: 14,
								backgroundColor: colors.primary,
								paddingHorizontal: 20,
								paddingVertical: 10,
								borderRadius: 10,
							}}
						>
							<Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Show All Items</Text>
						</TouchableOpacity>
					)}
				</View>
			) : filteredSchedule.map((group) => (
				<View key={group.id} style={styles.group}>
					<View style={styles.groupHeader}>
						<Text style={styles.groupTitle}>{group.title}</Text>
						<View style={styles.reminderBadge}>
							<Ionicons name="notifications-outline" size={12} color={colors.primary} />
							<Text style={styles.reminderBadgeText}>{group.reminderLabel}</Text>
						</View>
					</View>
					{group.items.map((it) => {
						const last = data[it.key] || 0;
						const progress = progressFor(last, group.intervalKm);
						const dueKm = last + group.intervalKm;
						const color = getWearColor(progress);
						
						// Calculate time-based progress
						const lastDate = lastServiceDates[it.key];
						let timeProgress = 0;
						let daysRemaining = null;
						let timeColor = '#22C55E'; // green
						if (lastDate && group.baselineDays) {
							const daysSince = Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
							timeProgress = Math.min(100, Math.round((daysSince / group.baselineDays) * 100));
							daysRemaining = group.baselineDays - daysSince;
							if (timeProgress >= 100) timeColor = '#DC2626'; // red
							else if (timeProgress >= 80) timeColor = '#F59E0B'; // amber
							else if (timeProgress >= 60) timeColor = '#FBBF24'; // yellow
						}
						
						// Use the worse of km or time progress for overall status
						const overallProgress = Math.max(progress, timeProgress);
						const overallColor = getWearColor(overallProgress);
						
						return (
							<View key={it.key} style={styles.card}>
								<View style={[styles.statusIndicator, { backgroundColor: overallColor }]} />
								
								<View style={styles.cardLeft}>
									<Text style={styles.itemName}>{it.name}</Text>
									<Text style={styles.itemNotes}>{it.notes}</Text>
									
									{/* KM-based info */}
									<Text style={styles.small}>
										<Ionicons name="speedometer-outline" size={11} color={colors.orangeShade5} /> Last: {last} km · Next: {dueKm} km
									</Text>
									
									{/* Time-based info */}
									{lastDate ? (
										<View style={styles.timeInfoRow}>
											<Text style={[styles.small, { color: timeColor }]}>
												<Ionicons name="calendar-outline" size={11} color={timeColor} /> {new Date(lastDate).toLocaleDateString()} 
												{daysRemaining !== null && (
													daysRemaining > 0 
														? ` · ${daysRemaining}d until due`
														: ` · ${Math.abs(daysRemaining)}d overdue!`
												)}
											</Text>
										</View>
									) : (
										<Text style={[styles.small, { color: '#F59E0B', marginTop: 2 }]}>
											<Ionicons name="alert-circle-outline" size={11} color="#F59E0B" /> No service date recorded
										</Text>
									)}

									{/* KM Progress Bar */}
									<View style={styles.progressSection}>
										<Text style={[styles.progressLabel]}>KM</Text>
										<View style={styles.barBackgroundSmall}>
											<View style={[styles.barFillSmall, { width: `${progress}%`, backgroundColor: color }]} />
										</View>
										<Text style={[styles.progressPercent, { color }]}>{progress}%</Text>
									</View>
									
									{/* Time Progress Bar */}
									{group.baselineDays && (
										<View style={styles.progressSection}>
											<Text style={[styles.progressLabel]}>Time</Text>
											<View style={styles.barBackgroundSmall}>
												<View style={[styles.barFillSmall, { width: `${timeProgress}%`, backgroundColor: timeColor }]} />
											</View>
											<Text style={[styles.progressPercent, { color: timeColor }]}>{timeProgress}%</Text>
										</View>
									)}
									
									<Text style={[styles.statusText, { color: overallColor }]}>
										{overallProgress < 30 ? '✓ Good' : overallProgress < 60 ? '⚠ Fair' : overallProgress < 80 ? '⚠ Worn' : '⛔ Critical'}
									</Text>
									
									{/* Show deferred reason if exists */}
									{skipReasons[it.key] && (
										<View style={styles.deferredReasonBox}>
											<Ionicons name="time-outline" size={12} color="#F59E0B" />
											<Text style={styles.deferredReasonText}>
												Deferred: {skipReasons[it.key].reason}
											</Text>
											<Text style={styles.deferredDateText}>
												({new Date(skipReasons[it.key].date).toLocaleDateString()})
											</Text>
										</View>
									)}
								</View>

								<View style={styles.cardRight}>
									<TouchableOpacity style={styles.doneBtn} onPress={() => onMarkDone(it.key)}>
										<Ionicons name="checkmark-done-outline" size={18} color={colors.ivory1} />
									</TouchableOpacity>
									{/* Show defer button for overdue items */}
									{(daysRemaining !== null && daysRemaining < 0) || progress >= 100 ? (
										<TouchableOpacity 
											style={styles.deferBtn} 
											onPress={() => onDefer({
												key: it.key,
												name: it.name,
												daysOverdue: daysRemaining !== null ? Math.abs(daysRemaining) : 0,
												kmOverdue: Math.max(0, (odometerKm || 0) - dueKm),
												group: group.title,
											})}
										>
											<Ionicons name="time-outline" size={18} color={colors.orangeShade6} />
										</TouchableOpacity>
									) : null}
								</View>
							</View>
						);
					})}
				</View>
			))}
		</View>
	);
};

export default MaintenanceScheduleList;
