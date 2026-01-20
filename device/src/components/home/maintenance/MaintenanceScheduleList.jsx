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
}) => {
	const progressFor = (lastKm, intervalKm) => {
		const cur = parseInt(odometerKm || currentKm || '0', 10);
		const last = parseInt(lastKm || '0', 10);
		const diff = Math.max(0, cur - last);
		const pct = Math.min(100, Math.round((diff / intervalKm) * 100));
		return pct;
	};

	return (
		<View>
			<Text style={styles.sectionTitle}>Maintenance Schedule Details</Text>
			
			{schedule.map((group) => (
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
