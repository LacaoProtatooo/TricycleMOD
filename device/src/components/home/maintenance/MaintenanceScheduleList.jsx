import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';
import { FALLBACK_SCHEDULE } from './maintenanceConstants';
import { getWearColor } from '../VehicleDiagnostic';

// AI Recommendation helpers — combines schedule progress + AI prediction + safety for best recommendation
const getAIRecommendation = (prediction, overallProgress) => {
	if (!prediction) return null;
	const km = prediction.predictedKm || 0;
	const isSafety = prediction.safetyPriority === 'high';
	
	// Safety items: trigger warnings earlier (more conservative)
	if (isSafety) {
		if (km <= 100 || overallProgress >= 90) {
			return { label: 'Service Now', color: '#DC2626', icon: 'alert-circle', priority: 1 };
		}
		if (km <= 300 || overallProgress >= 70) {
			return { label: 'Service Soon', color: '#F59E0B', icon: 'time', priority: 2 };
		}
		if (km <= 500 || overallProgress >= 50) {
			return { label: 'Schedule Service', color: '#3B82F6', icon: 'calendar', priority: 3 };
		}
		return { label: 'Good — Safe', color: '#22C55E', icon: 'shield-checkmark', priority: 4 };
	}
	
	// Regular items
	if (km <= 50 || overallProgress >= 100) {
		return { label: 'Service Now', color: '#DC2626', icon: 'alert-circle', priority: 1 };
	}
	if (km <= 200 || overallProgress >= 80) {
		return { label: 'Service Soon', color: '#F59E0B', icon: 'time', priority: 2 };
	}
	if (km <= 500 || overallProgress >= 60) {
		return { label: 'Schedule Service', color: '#3B82F6', icon: 'calendar', priority: 3 };
	}
	return { label: 'Good Condition', color: '#22C55E', icon: 'checkmark-circle', priority: 4 };
};

const getHealthLabel = (score) => {
	if (score >= 80) return { text: 'Excellent', color: '#22C55E' };
	if (score >= 60) return { text: 'Good', color: '#84CC16' };
	if (score >= 40) return { text: 'Fair', color: '#EAB308' };
	if (score >= 20) return { text: 'Poor', color: '#F97316' };
	return { text: 'Critical', color: '#EF4444' };
};

const MaintenanceScheduleList = ({
	data,
	lastServiceDates,
	skipReasons,
	odometerKm,
	currentKm,
	onMarkDone,
	onDefer,
	schedule = FALLBACK_SCHEDULE,
	filter = 'all',
	onClearFilter,
	predictions = {},
	anomalies = [],
	healthScore = 100,
	onMaintenanceNeeded,
	maintenanceRecords = {},
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

	// Build anomaly lookup for quick access
	const anomalyMap = {};
	anomalies.forEach(a => { anomalyMap[a.itemKey] = a; });

	// Count AI insights
	const aiInsightCount = Object.values(predictions).filter(p => p.method === 'ai_regression').length;
	const adaptedCount = Object.values(predictions).filter(p => p.method === 'adaptive_interval').length;
	const urgentAICount = Object.values(predictions).filter(p => p.predictedKm <= 100).length;
	const safetyUrgentCount = Object.values(predictions).filter(p => p.safetyPriority === 'high' && p.predictedKm <= 200).length;
	const avgConfidence = Object.values(predictions).length > 0
		? Math.round(Object.values(predictions).reduce((s, p) => s + (p.confidence || 0), 0) / Object.values(predictions).length)
		: 0;
	const health = getHealthLabel(healthScore);

	// Detect if the vehicle is idle (most predictions agree)
	const idlePredictions = Object.values(predictions).filter(p => p.isVehicleIdle);
	const isVehicleIdle = idlePredictions.length > Object.values(predictions).length / 2;
	const maxDaysExceededCount = Object.values(predictions).filter(p => p.maxDaysExceeded).length;
	const timeSensitiveIdleCount = Object.values(predictions).filter(p => p.isVehicleIdle && p.timeDecayType === 'time_sensitive').length;

	return (
		<View>
			{/* AI Health Score & Insights Summary Card */}
			<View style={aiStyles.healthCard}>
				<View style={aiStyles.healthRow}>
					<View style={aiStyles.healthScoreCircle}>
						<Text style={[aiStyles.healthScoreNum, { color: health.color }]}>{healthScore}</Text>
					</View>
					<View style={{ flex: 1, marginLeft: 12 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
							<Ionicons name="sparkles" size={14} color="#a78bfa" />
							<Text style={aiStyles.healthTitle}>  AI Vehicle Health</Text>
						</View>
						<Text style={[aiStyles.healthLabel, { color: health.color }]}>{health.text} — {avgConfidence}% avg. confidence</Text>
						<View style={aiStyles.healthStatsRow}>
							{urgentAICount > 0 && (
								<View style={[aiStyles.healthStat, { backgroundColor: '#DC262615' }]}>
									<Text style={[aiStyles.healthStatText, { color: '#DC2626' }]}>{urgentAICount} urgent</Text>
								</View>
							)}
							{safetyUrgentCount > 0 && (
								<View style={[aiStyles.healthStat, { backgroundColor: '#EF444415' }]}>
									<Text style={[aiStyles.healthStatText, { color: '#EF4444' }]}>{safetyUrgentCount} safety</Text>
								</View>
							)}
							{aiInsightCount > 0 && (
								<View style={[aiStyles.healthStat, { backgroundColor: '#a78bfa15' }]}>
									<Text style={[aiStyles.healthStatText, { color: '#a78bfa' }]}>{aiInsightCount} ML</Text>
								</View>
							)}
							{adaptedCount > 0 && (
								<View style={[aiStyles.healthStat, { backgroundColor: '#22C55E15' }]}>
									<Text style={[aiStyles.healthStatText, { color: '#16A34A' }]}>{adaptedCount} adapted</Text>
								</View>
							)}
						</View>
					</View>
					{/* Health bar */}
					<View style={aiStyles.healthBarContainer}>
						<View style={[aiStyles.healthBar, { height: `${healthScore}%`, backgroundColor: health.color }]} />
					</View>
				</View>
				<Text style={aiStyles.healthNote}>
					{aiInsightCount + adaptedCount > 0
						? 'Predictions adapt to your riding habits. Confidence improves with each service you complete.'
						: 'Complete maintenance services to help AI learn your riding patterns and improve predictions.'
					}
				</Text>
			</View>

		{/* Idle Vehicle Advisory Banner */}
		{isVehicleIdle && (
			<View style={{
				marginBottom: 10, padding: 12, borderRadius: 10,
				backgroundColor: '#3B82F610', borderWidth: 1, borderColor: '#3B82F625',
			}}>
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
					<Ionicons name="moon-outline" size={16} color="#3B82F6" />
					<Text style={{ fontSize: 13, fontWeight: '700', color: '#3B82F6', marginLeft: 6 }}>Vehicle Appears Idle</Text>
				</View>
				<Text style={{ fontSize: 12, color: '#64748B', lineHeight: 17 }}>
					Low usage detected — mechanical parts (chain, clutch, brakes) won't wear much while parked, but fluids, battery, and rubber still degrade over time.
				</Text>
				{timeSensitiveIdleCount > 0 && (
					<View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#F59E0B10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
						<Ionicons name="alert-circle" size={12} color="#F59E0B" />
						<Text style={{ fontSize: 11, color: '#92400E', marginLeft: 4 }}>
							{timeSensitiveIdleCount} part(s) are time-sensitive and still need attention
							{maxDaysExceededCount > 0 ? ` (${maxDaysExceededCount} overdue)` : ''}
						</Text>
					</View>
				)}
			</View>
		)}

		{/* Anomaly Alerts */}
		{anomalies.length > 0 && (
			<View style={{ marginBottom: 10 }}>
				{anomalies.slice(0, 3).map((anomaly) => (
					<View key={anomaly.itemKey} style={aiStyles.anomalyBanner}>
						<Ionicons 
							name={anomaly.severity === 'critical' ? 'warning' : 'alert-circle'} 
							size={16} 
							color={anomaly.severity === 'critical' ? '#EF4444' : '#F97316'} 
						/>
							<View style={{ flex: 1, marginLeft: 8 }}>
								<Text style={aiStyles.anomalyTitle}>{anomaly.itemName}</Text>
								<Text style={aiStyles.anomalyMsg}>{anomaly.message}</Text>
								{anomaly.recommendation && (
									<Text style={aiStyles.anomalyRec}>
										<Ionicons name="bulb-outline" size={11} color="#60A5FA" /> {anomaly.recommendation}
									</Text>
								)}
							</View>
						</View>
					))}
				</View>
			)}

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

						// AI prediction & recommendation for this item
						const prediction = predictions[it.key];
						const anomaly = anomalyMap[it.key];
						const recommendation = getAIRecommendation(prediction, overallProgress);
						
						return (
							<View key={it.key} style={styles.card}>
								<View style={[styles.statusIndicator, { backgroundColor: overallColor }]} />
								
								<View style={styles.cardLeft}>
									<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
										<Text style={[styles.itemName, { flex: 1 }]}>{it.name}</Text>
										{/* AI Recommendation Badge */}
										{recommendation && (
											<View style={[aiStyles.recBadge, { backgroundColor: recommendation.color + '15', borderColor: recommendation.color + '30' }]}>
												<Ionicons name={recommendation.icon} size={10} color={recommendation.color} />
												<Text style={[aiStyles.recBadgeText, { color: recommendation.color }]}>{recommendation.label}</Text>
											</View>
										)}
									</View>
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
									<View style={{ marginTop: 6 }}>
										<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
											<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
												<Ionicons name="speedometer-outline" size={10} color={color} />
												<Text style={{ fontSize: 10, fontWeight: '700', color }}>{progress}%</Text>
											</View>
											<Text style={{ fontSize: 10, color: colors.orangeShade5 }}>
												{Math.max(0, (parseInt(odometerKm || currentKm || '0', 10) - last)).toLocaleString()} / {group.intervalKm.toLocaleString()} km
											</Text>
										</View>
										<View style={styles.barBackgroundSmall}>
											<View style={[styles.barFillSmall, { width: `${progress}%`, backgroundColor: color }]} />
										</View>
									</View>
									
									{/* Time Progress Bar */}
									{group.baselineDays && (
										<View style={{ marginTop: 6 }}>
											<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
												<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
													<Ionicons name="calendar-outline" size={10} color={timeColor} />
													<Text style={{ fontSize: 10, fontWeight: '700', color: timeColor }}>{timeProgress}%</Text>
												</View>
												<Text style={{ fontSize: 10, color: colors.orangeShade5 }}>
													{lastDate ? Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24)) : 0} / {group.baselineDays} days
												</Text>
											</View>
											<View style={styles.barBackgroundSmall}>
												<View style={[styles.barFillSmall, { width: `${timeProgress}%`, backgroundColor: timeColor }]} />
											</View>
										</View>
									)}
									
									<Text style={[styles.statusText, { color: overallColor }]}>
										{overallProgress < 30 ? '✓ Good' : overallProgress < 60 ? '⚠ Fair' : overallProgress < 80 ? '⚠ Worn' : '⛔ Critical'}
									</Text>

									{/* AI Prediction Insight Row */}
									{prediction && (
										<View style={aiStyles.insightContainer}>
											<View style={aiStyles.insightRow}>
												<Ionicons name="sparkles" size={11} color="#a78bfa" />
												<Text style={aiStyles.insightText}>
													AI: ~{prediction.predictedKm <= 0 ? 'Due now' : `${prediction.predictedKm} km left`}
												</Text>
												<Text style={aiStyles.insightConfidence}>
													{prediction.confidence}% conf.
												</Text>
												{prediction.method === 'ai_regression' && (
													<View style={aiStyles.aiMethodTag}>
														<Text style={aiStyles.aiMethodText}>ML</Text>
													</View>
												)}
												{prediction.method === 'adaptive_interval' && (
													<View style={[aiStyles.aiMethodTag, { backgroundColor: '#22C55E20' }]}>
														<Text style={[aiStyles.aiMethodText, { color: '#16A34A' }]}>Adapted</Text>
													</View>
												)}
											</View>
											{/* Safety priority indicator */}
											{prediction.safetyPriority === 'high' && (
												<View style={aiStyles.safetyRow}>
													<Ionicons name="shield-checkmark" size={11} color="#DC2626" />
													<Text style={aiStyles.safetyText}>
														Safety-critical — recommended earlier service for safe riding
													</Text>
												</View>
											)}
											{/* Adapted interval info */}
											{prediction.adaptedInterval && prediction.adaptedInterval !== group.intervalKm && (
												<View style={aiStyles.adaptedRow}>
													<Ionicons name="trending-up" size={11} color="#6D28D9" />
													<Text style={aiStyles.adaptedText}>
														Learned interval: {prediction.adaptedInterval} km (based on your habits)
													</Text>
												</View>
											)}
											{/* Time decay warning */}
											{prediction.timeFactor > 1.1 && prediction.daysSinceService !== null && (
												<View style={aiStyles.insightAnomalyRow}>
													<Ionicons name="time" size={11} color="#F59E0B" />
													<Text style={aiStyles.insightAnomalyText}>
														{prediction.daysSinceService}d since service — time-based wear factored in
													</Text>
												</View>
											)}
											{/* Idle vehicle context for this specific part */}
											{prediction.isVehicleIdle && prediction.timeDecayType === 'usage_based' && (
												<View style={aiStyles.insightAnomalyRow}>
													<Ionicons name="pause-circle" size={11} color="#3B82F6" />
													<Text style={[aiStyles.insightAnomalyText, { color: '#3B82F6' }]}>
														Vehicle idle — this part only wears from riding, no time pressure
													</Text>
												</View>
											)}
											{prediction.isVehicleIdle && prediction.timeDecayType === 'time_sensitive' && (
												<View style={aiStyles.insightAnomalyRow}>
													<Ionicons name="water" size={11} color="#F59E0B" />
													<Text style={aiStyles.insightAnomalyText}>
														Still degrades while parked{prediction.maxDaysExceeded ? ' — MAX TIME EXCEEDED' : ` (max ${prediction.maxDaysInterval}d)`}
													</Text>
												</View>
											)}
											{prediction.isVehicleIdle && prediction.timeDecayType === 'hybrid' && (
												<View style={aiStyles.insightAnomalyRow}>
													<Ionicons name="hourglass" size={11} color="#6D28D9" />
													<Text style={[aiStyles.insightAnomalyText, { color: '#6D28D9' }]}>
														Slow time degradation while parked (30% rate)
													</Text>
												</View>
											)}
											{anomaly && (
												<View style={aiStyles.insightAnomalyRow}>
													<Ionicons name="warning" size={11} color="#F97316" />
													<Text style={aiStyles.insightAnomalyText}>
														{anomaly.message}
													</Text>
												</View>
											)}
										</View>
									)}
									
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
									{(() => {
										const latestRecord = maintenanceRecords[it.key]?.[0];
										const isPending = latestRecord?.approvalStatus === 'pending';
										return isPending ? (
											<View style={[styles.doneBtn, { backgroundColor: '#9CA3AF', opacity: 0.7, alignItems: 'center' }]}>
												<Ionicons name="hourglass-outline" size={16} color={colors.ivory1} />
												<Text style={{ fontSize: 8, color: colors.ivory1, fontWeight: '600', marginTop: 2 }}>Pending</Text>
											</View>
										) : (
											<TouchableOpacity style={styles.doneBtn} onPress={() => onMarkDone(it.key)}>
												<Ionicons name="checkmark-done-outline" size={18} color={colors.ivory1} />
											</TouchableOpacity>
										);
									})()}
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

// AI integration styles
const aiStyles = StyleSheet.create({
	// Health card at top of schedule
	healthCard: {
		backgroundColor: colors.ivory2 || '#f5f5f0',
		borderRadius: 12,
		padding: 14,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: colors.ivory3 || '#e8e8e0',
	},
	healthRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	healthScoreCircle: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: colors.ivory1 || '#fff',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: colors.ivory3 || '#e8e8e0',
	},
	healthScoreNum: {
		fontSize: 20,
		fontWeight: '800',
	},
	healthTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.orangeShade7 || '#333',
	},
	healthLabel: {
		fontSize: 12,
		fontWeight: '600',
		marginBottom: 6,
	},
	healthStatsRow: {
		flexDirection: 'row',
		gap: 6,
	},
	healthStat: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
	},
	healthStatText: {
		fontSize: 10,
		fontWeight: '600',
	},
	healthBarContainer: {
		width: 8,
		height: 42,
		backgroundColor: colors.ivory3 || '#e8e8e0',
		borderRadius: 4,
		overflow: 'hidden',
		justifyContent: 'flex-end',
	},
	healthBar: {
		width: '100%',
		borderRadius: 4,
	},
	healthNote: {
		fontSize: 10,
		color: colors.orangeShade5 || '#888',
		marginTop: 8,
		fontStyle: 'italic',
	},
	// Anomaly banner
	anomalyBanner: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#FEF3C7',
		borderRadius: 10,
		padding: 10,
		marginBottom: 6,
		borderWidth: 1,
		borderColor: '#FDE68A',
	},
	anomalyTitle: {
		fontSize: 12,
		fontWeight: '700',
		color: '#92400E',
	},
	anomalyMsg: {
		fontSize: 11,
		color: '#B45309',
		marginTop: 1,
	},
	anomalyRec: {
		fontSize: 10,
		color: '#3B82F6',
		marginTop: 3,
	},
	// Recommendation badge on item name row
	recBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 7,
		paddingVertical: 3,
		borderRadius: 6,
		borderWidth: 1,
		gap: 3,
		marginLeft: 6,
	},
	recBadgeText: {
		fontSize: 9,
		fontWeight: '700',
	},
	// AI insight row inside each card
	insightContainer: {
		backgroundColor: '#F5F3FF',
		borderRadius: 8,
		padding: 7,
		marginTop: 5,
		borderWidth: 1,
		borderColor: '#E9E5FF',
	},
	insightRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
	},
	insightText: {
		fontSize: 11,
		fontWeight: '600',
		color: '#6D28D9',
		flex: 1,
	},
	insightConfidence: {
		fontSize: 10,
		color: '#8B5CF6',
	},
	aiMethodTag: {
		backgroundColor: '#a78bfa20',
		paddingHorizontal: 5,
		paddingVertical: 1,
		borderRadius: 4,
		marginLeft: 3,
	},
	aiMethodText: {
		fontSize: 8,
		fontWeight: '700',
		color: '#7C3AED',
	},
	insightAnomalyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 4,
	},
	insightAnomalyText: {
		fontSize: 10,
		color: '#EA580C',
		flex: 1,
	},
	safetyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 4,
	},
	safetyText: {
		fontSize: 10,
		color: '#DC2626',
		fontWeight: '600',
		flex: 1,
	},
	adaptedRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 3,
	},
	adaptedText: {
		fontSize: 10,
		color: '#6D28D9',
		flex: 1,
	},
});