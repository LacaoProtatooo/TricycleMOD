import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { colors, spacing, fonts } from '../../components/common/theme';
import Constants from 'expo-constants';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import VehicleDiagnostic, { getWearColor } from './VehicleDiagnostic';
import PredictiveMaintenance from './PredictiveMaintenance';

// Key for tracking which notifications have been sent
const NOTIFIED_ITEMS_KEY = 'maintenance_notified_items_v1';
const WEAR_PATTERNS_KEY = 'wear_patterns_v1';
const MAINTENANCE_HISTORY_KEY = 'maintenance_history_v2';

const BACKEND = (Constants?.expoConfig?.extra?.BACKEND_URL) || (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.105:5000';
const STORAGE_KEY = 'maintenance_data_v1';

// same key used in BackgroundLocationTask
const KM_KEY = 'vehicle_current_km_v1';

const defaultSchedule = [
	{
		id: 'weekly',
		title: 'Weekly (or every 300–500 km)',
		intervalKm: 500,
		items: [
			{ key: 'tire_pressure', name: 'Tire pressure', notes: 'Recheck and inflate, check for uneven wear' },
			{ key: 'chain', name: 'Chain', notes: 'Clean, lubricate, and adjust' },
			{ key: 'battery_water', name: 'Battery water', notes: 'Top up with distilled water (non-MF)' },
			{ key: 'air_filter_clean', name: 'Air filter (clean)', notes: 'Clean using compressed air' },
			{ key: 'brake_check', name: 'Brake system', notes: 'Check pads/shoes for wear' },
			{ key: 'cables', name: 'Cables', notes: 'Lubricate clutch/throttle cables' },
		],
	},
	{
		id: '1000',
		title: 'Every 1,000 km (monthly heavy use)',
		intervalKm: 1000,
		items: [
			{ key: 'engine_oil', name: 'Engine oil', notes: 'Replace (SAE 10W-40 or 20W-50)' },
			{ key: 'spark_plug', name: 'Spark plug', notes: 'Inspect/clean or replace; gap 0.7–0.8 mm' },
			{ key: 'carburetor', name: 'Carburetor', notes: 'Check idle & mixture' },
			{ key: 'chain_sprockets', name: 'Chain & sprockets', notes: 'Inspect for wear' },
		],
	},
	{
		id: '3000-5000',
		title: 'Every 3,000–5,000 km',
		intervalKm: 4000,
		items: [
			{ key: 'oil_filter', name: 'Oil filter', notes: 'Replace if equipped' },
			{ key: 'air_filter_replace', name: 'Air filter (replace)', notes: 'Replace if dusty/oily' },
			{ key: 'valve_clearance', name: 'Valve clearance', notes: 'Adjust per spec' },
			{ key: 'battery_test', name: 'Battery', notes: 'Test voltage; replace if weak' },
		],
	},
	{
		id: '10000',
		title: 'Every 10,000–12,000 km (or annually)',
		intervalKm: 11000,
		items: [
			{ key: 'brake_fluid_flush', name: 'Brake fluid (flush)', notes: 'Flush & replace' },
			{ key: 'clutch_plates', name: 'Clutch plates', notes: 'Inspect & replace if slipping' },
			{ key: 'suspension', name: 'Suspension', notes: 'Inspect fork oil & shocks' },
		],
	},
	{
		id: '20000',
		title: 'Major service — Every 20,000 km',
		intervalKm: 20000,
		items: [
			{ key: 'engine_overhaul', name: 'Engine overhaul', notes: 'Check rings, valves, gaskets' },
			{ key: 'transmission_oil', name: 'Transmission oil', notes: 'Replace if applicable' },
			{ key: 'wiring_harness', name: 'Wiring harness', notes: 'Replace brittle wiring' },
		],
	},
];

const MaintenanceTracker = ({ tricycleId, serverHistory }) => {
    const db = useAsyncSQLiteContext();
	const [currentKm, setCurrentKm] = useState('');
	const [data, setData] = useState({}); // { itemKey: lastServiceKm }
	const [loaded, setLoaded] = useState(false);
	const [odometerKm, setOdometerKm] = useState(null);
	const [notifiedItems, setNotifiedItems] = useState({}); // Track which items have been notified
	const hasCheckedNotifications = useRef(false);
	const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'predictive'
	const [wearPatterns, setWearPatterns] = useState({});

	// Setup notification channel for maintenance alerts
	useEffect(() => {
		const setupNotificationChannel = async () => {
			await Notifications.setNotificationChannelAsync('maintenance', {
				name: 'Maintenance Alerts',
				description: 'Reminders for critical vehicle maintenance',
				importance: Notifications.AndroidImportance.HIGH,
				sound: 'default',
				vibrationPattern: [0, 250, 250, 250],
				lightColor: '#FF6B35',
				showBadge: true,
			});
		};
		setupNotificationChannel();
		
		// Load previously notified items
		const loadNotifiedItems = async () => {
			try {
				const key = tricycleId ? `${NOTIFIED_ITEMS_KEY}_${tricycleId}` : NOTIFIED_ITEMS_KEY;
				const saved = await AsyncStorage.getItem(key);
				if (saved) {
					setNotifiedItems(JSON.parse(saved));
				}
			} catch (e) {
				console.warn('Error loading notified items:', e);
			}
		};
		loadNotifiedItems();
	}, [tricycleId]);

	// Check for critical items and send notifications
	const checkAndNotifyCriticalItems = async (maintenanceData, currentOdometer) => {
		if (!maintenanceData || currentOdometer === null) return;
		
		const criticalItems = [];
		const wornItems = [];
		const newNotifiedItems = { ...notifiedItems };
		
		defaultSchedule.forEach(group => {
			group.items.forEach(item => {
				const lastKm = maintenanceData[item.key] || 0;
				const diff = Math.max(0, currentOdometer - lastKm);
				const progress = Math.min(100, Math.round((diff / group.intervalKm) * 100));
				
				// Create a unique key for this notification cycle
				const notifyKey = `${item.key}_${lastKm}`;
				
				if (progress >= 80 && !newNotifiedItems[notifyKey]) {
					criticalItems.push({ ...item, progress, group: group.title });
					newNotifiedItems[notifyKey] = Date.now();
				} else if (progress >= 60 && progress < 80 && !newNotifiedItems[`worn_${notifyKey}`]) {
					wornItems.push({ ...item, progress, group: group.title });
					newNotifiedItems[`worn_${notifyKey}`] = Date.now();
				}
			});
		});
		
		// Send notification for critical items
		if (criticalItems.length > 0) {
			const itemNames = criticalItems.map(i => i.name).join(', ');
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Critical Maintenance Required!',
					body: `The following items need immediate attention: ${itemNames}`,
					data: { type: 'maintenance', items: criticalItems },
					sound: 'default',
				},
				trigger: null, // Send immediately
			});
		}
		
		// Send notification for worn items (approaching critical)
		if (wornItems.length > 0) {
			const itemNames = wornItems.map(i => i.name).join(', ');
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Maintenance Reminder',
					body: `These items are approaching maintenance due: ${itemNames}`,
					data: { type: 'maintenance', items: wornItems },
					sound: 'default',
				},
				trigger: null,
			});
		}
		
		// Save notified items to prevent duplicate notifications
		if (criticalItems.length > 0 || wornItems.length > 0) {
			setNotifiedItems(newNotifiedItems);
			try {
				const key = tricycleId ? `${NOTIFIED_ITEMS_KEY}_${tricycleId}` : NOTIFIED_ITEMS_KEY;
				await AsyncStorage.setItem(key, JSON.stringify(newNotifiedItems));
			} catch (e) {
				console.warn('Error saving notified items:', e);
			}
		}
	};

	// Check notifications when data and odometer are loaded
	useEffect(() => {
		if (loaded && odometerKm !== null && !hasCheckedNotifications.current) {
			hasCheckedNotifications.current = true;
			checkAndNotifyCriticalItems(data, odometerKm);
		}
	}, [loaded, odometerKm, data]);

	useEffect(() => {
        loadData();
	}, [tricycleId, serverHistory]);

    const loadData = async () => {
        try {
            // 1. Calculate state from serverHistory
            let serverState = {};
            if (serverHistory && Array.isArray(serverHistory)) {
                serverHistory.forEach(log => {
                    if (serverState[log.itemKey] === undefined || log.lastServiceKm > serverState[log.itemKey]) {
                        serverState[log.itemKey] = log.lastServiceKm;
                    }
                });
            }

            // 2. Load local cache (keyed by tricycleId)
            const key = tricycleId ? `maintenance_data_${tricycleId}` : 'maintenance_data_local';
            const saved = await AsyncStorage.getItem(key);
            let localState = saved ? JSON.parse(saved) : {};

            // 3. Merge (prefer server if available, or max?)
            const merged = { ...localState };
            Object.keys(serverState).forEach(k => {
                if (merged[k] === undefined || serverState[k] > merged[k]) {
                    merged[k] = serverState[k];
                }
            });
            
            setData(merged);
            
            const km = await AsyncStorage.getItem(KM_KEY);
            if (km) setCurrentKm(km);

            // 4. Load wear patterns for predictive maintenance
            const patternsKey = tricycleId ? `${WEAR_PATTERNS_KEY}_${tricycleId}` : WEAR_PATTERNS_KEY;
            const patternsStr = await AsyncStorage.getItem(patternsKey);
            if (patternsStr) {
                setWearPatterns(JSON.parse(patternsStr));
            }
        } catch (e) {
            console.warn('MaintenanceTracker load error', e);
        } finally {
            setLoaded(true);
        }
    };

	// load once and then poll AsyncStorage so odometer reflects realtime updates
	useEffect(() => {
		let mounted = true;
		const loadOdometer = async () => {
			try {
				const raw = await AsyncStorage.getItem(KM_KEY);
				if (!mounted) return;
				setOdometerKm(raw ? Number(raw) : 0);
			} catch (e) {
				// ignore
			}
		};
		loadOdometer();
		const interval = setInterval(loadOdometer, 2000); // poll every 2s
		return () => { mounted = false; clearInterval(interval); };
	}, []);

	const saveKm = async () => {
		try {
			const v = String(parseInt(currentKm || '0', 10));
			await AsyncStorage.setItem(KM_KEY, v);
			setCurrentKm(v);
			Alert.alert('Saved', `Current odometer set to ${v} km`);
		} catch (e) {
			console.warn('saveKm error', e);
		}
	};

    // Function to save to server
    const saveToServer = async (itemKey, lastServiceKm, notes) => {
        if (!tricycleId || !db) return;
        try {
            const token = await getToken(db);
            await fetch(`${BACKEND}/api/tricycles/${tricycleId}/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    itemKey,
                    lastServiceKm,
                    notes
                })
            });
        } catch (error) {
            console.error("Failed to sync maintenance to server", error);
        }
    };

	const markDone = async (itemKey) => {
		try {
			const kmNum = parseInt(odometerKm || currentKm || '0', 10);
			const previousKm = data[itemKey] || 0;
			const next = { ...data, [itemKey]: kmNum };
            
            // Save to dynamic key
            const key = tricycleId ? `maintenance_data_${tricycleId}` : 'maintenance_data_local';
			await AsyncStorage.setItem(key, JSON.stringify(next));
			setData(next);

            // Sync to server
            await saveToServer(itemKey, kmNum, "Completed via app");
			
			// Track wear pattern for AI predictions
			await trackWearPattern(itemKey, kmNum, previousKm);

			// Save to maintenance history for predictive analytics
			await saveToMaintenanceHistory(itemKey, kmNum);
			
			// Clear the notification flag for this item so it can notify again in the next cycle
			const notifyKey = tricycleId ? `${NOTIFIED_ITEMS_KEY}_${tricycleId}` : NOTIFIED_ITEMS_KEY;
			const updatedNotified = { ...notifiedItems };
			// Remove old notification keys for this item
			Object.keys(updatedNotified).forEach(k => {
				if (k.includes(itemKey)) {
					delete updatedNotified[k];
				}
			});
			setNotifiedItems(updatedNotified);
			await AsyncStorage.setItem(notifyKey, JSON.stringify(updatedNotified));
			
			Alert.alert('Success', `${itemKey.replace(/_/g, ' ')} marked as maintained at ${kmNum} km`);
		} catch (e) {
			console.warn('markDone error', e);
		}
	};

	// Track wear patterns for predictive maintenance AI
	const trackWearPattern = async (itemKey, currentKm, previousServiceKm) => {
		try {
			const patternsKey = tricycleId ? `${WEAR_PATTERNS_KEY}_${tricycleId}` : WEAR_PATTERNS_KEY;
			const currentPatterns = { ...wearPatterns };
			
			if (!currentPatterns[itemKey]) {
				currentPatterns[itemKey] = [];
			}
			
			// Calculate wear level based on km since last service
			const kmSinceService = currentKm - previousServiceKm;
			const itemSchedule = defaultSchedule.find(g => g.items.find(i => i.key === itemKey));
			const expectedInterval = itemSchedule?.intervalKm || 1000;
			const wearLevel = Math.min(100, (kmSinceService / expectedInterval) * 100);
			
			// Add data point
			currentPatterns[itemKey].push({
				km: currentKm,
				wearLevel: wearLevel,
				kmSinceLastService: kmSinceService,
				timestamp: Date.now(),
			});
			
			// Keep only last 20 data points per item
			if (currentPatterns[itemKey].length > 20) {
				currentPatterns[itemKey] = currentPatterns[itemKey].slice(-20);
			}
			
			setWearPatterns(currentPatterns);
			await AsyncStorage.setItem(patternsKey, JSON.stringify(currentPatterns));
		} catch (e) {
			console.warn('trackWearPattern error', e);
		}
	};

	// Save to maintenance history for analytics
	const saveToMaintenanceHistory = async (itemKey, kmNum) => {
		try {
			const historyKey = tricycleId ? `${MAINTENANCE_HISTORY_KEY}_${tricycleId}` : MAINTENANCE_HISTORY_KEY;
			const historyStr = await AsyncStorage.getItem(historyKey);
			let history = historyStr ? JSON.parse(historyStr) : [];
			
			history.push({
				itemKey,
				km: kmNum,
				date: new Date().toISOString(),
				type: 'maintenance_completed',
			});
			
			// Keep last 200 entries
			if (history.length > 200) {
				history = history.slice(-200);
			}
			
			await AsyncStorage.setItem(historyKey, JSON.stringify(history));
		} catch (e) {
			console.warn('saveToMaintenanceHistory error', e);
		}
	};

	const progressFor = (lastKm, intervalKm) => {
		const cur = parseInt(odometerKm || currentKm || '0', 10);
		const last = parseInt(lastKm || '0', 10);
		const diff = Math.max(0, cur - last);
		const pct = Math.min(100, Math.round((diff / intervalKm) * 100));
		return pct;
	};
	
	// Build parts status for blueprint
	const partsStatus = {};
	let criticalCount = 0;
	let wornCount = 0;
	
	defaultSchedule.forEach(group => {
		group.items.forEach(item => {
			const last = data[item.key] || 0;
			const progress = progressFor(last, group.intervalKm);
			partsStatus[item.key] = {
				progress,
				lastService: last,
				nextService: last + group.intervalKm,
				name: item.name
			};
			
			if (progress >= 80) criticalCount++;
			else if (progress >= 60) wornCount++;
		});
	});

	// Manual check for critical items notification
	const handleCheckCritical = async () => {
		hasCheckedNotifications.current = false;
		await checkAndNotifyCriticalItems(data, odometerKm);
		
		if (criticalCount === 0 && wornCount === 0) {
			Alert.alert('All Good!', 'No critical or worn maintenance items at this time.');
		} else {
			Alert.alert(
				'Maintenance Status',
				`${criticalCount} critical item(s) and ${wornCount} worn item(s) found. Notifications sent.`
			);
		}
	};

	// Handle maintenance needed from predictive component
	const handleMaintenanceNeeded = (itemKey) => {
		// Find the item and show details
		const group = defaultSchedule.find(g => g.items.find(i => i.key === itemKey));
		const item = group?.items.find(i => i.key === itemKey);
		if (item) {
			Alert.alert(
				`${item.name} Needs Attention`,
				`${item.notes}\n\nMark as completed?`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Mark Done', onPress: () => markDone(itemKey) },
				]
			);
		}
	};

	if (!loaded) return null;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Maintenance Tracker</Text>

            {/* Realtime odometer */}
            <View style={styles.odometerRow}>
                <Text style={styles.odometerLabel}>Odometer</Text>
                <Text style={styles.odometerValue}>{odometerKm !== null ? `${odometerKm.toFixed(3)} km` : '—'}</Text>
            </View>

			{/* Tab Switcher */}
			<View style={styles.tabContainer}>
				<TouchableOpacity 
					style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
					onPress={() => setActiveTab('schedule')}
				>
					<Ionicons 
						name="list-outline" 
						size={18} 
						color={activeTab === 'schedule' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
						Schedule
					</Text>
				</TouchableOpacity>
				<TouchableOpacity 
					style={[styles.tab, activeTab === 'predictive' && styles.tabActive]}
					onPress={() => setActiveTab('predictive')}
				>
					<Ionicons 
						name="analytics-outline" 
						size={18} 
						color={activeTab === 'predictive' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'predictive' && styles.tabTextActive]}>
						AI Predictions
					</Text>
				</TouchableOpacity>
			</View>

			{/* Critical/Worn Summary Banner */}
			{(criticalCount > 0 || wornCount > 0) && (
				<View style={[
					styles.alertBanner, 
					criticalCount > 0 ? styles.criticalBanner : styles.wornBanner
				]}>
					<Ionicons 
						name={criticalCount > 0 ? "warning" : "alert-circle"} 
						size={20} 
						color="#FFF" 
					/>
					<Text style={styles.alertText}>
						{criticalCount > 0 
							? `${criticalCount} item(s) need immediate attention!`
							: `${wornCount} item(s) approaching maintenance due`
						}
					</Text>
					<TouchableOpacity 
						style={styles.alertButton}
						onPress={handleCheckCritical}
					>
						<Ionicons name="notifications" size={16} color="#FFF" />
					</TouchableOpacity>
				</View>
			)}

            {!tricycleId && (
                <Text style={{color: 'red', marginBottom: 10, fontSize: 12}}>
                    No tricycle assigned. Data will be saved locally only.
                </Text>
            )}

			{/* Predictive AI Tab Content */}
			{activeTab === 'predictive' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: spacing.large }}
					showsVerticalScrollIndicator={false}
				>
					<PredictiveMaintenance 
						maintenanceData={data}
						tricycleId={tricycleId}
						onMaintenanceNeeded={handleMaintenanceNeeded}
					/>
				</ScrollView>
			)}

			{/* Schedule Tab Content */}
			{activeTab === 'schedule' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: spacing.large }}
					showsVerticalScrollIndicator={false}
				>
					{/* Vehicle Diagnostic View */}
					<VehicleDiagnostic partsStatus={partsStatus} />
					
					{/* Detailed List View */}
					<Text style={styles.sectionTitle}>Maintenance Schedule Details</Text>
					
					{defaultSchedule.map((group) => (
						<View key={group.id} style={styles.group}>
							<Text style={styles.groupTitle}>{group.title}</Text>
							{group.items.map((it) => {
								const last = data[it.key] || 0;
								const progress = progressFor(last, group.intervalKm);
								const dueKm = last + group.intervalKm;
								const color = getWearColor(progress);
								
								return (
									<View key={it.key} style={styles.card}>
										<View style={[styles.statusIndicator, { backgroundColor: color }]} />
										
										<View style={styles.cardLeft}>
											<Text style={styles.itemName}>{it.name}</Text>
											<Text style={styles.itemNotes}>{it.notes}</Text>
											<Text style={styles.small}>Last: {last} km · Next: {dueKm} km</Text>

											<View style={styles.barBackground}>
												<View style={[styles.barFill, { width: `${progress}%`, backgroundColor: color }]} />
											</View>
											<Text style={[styles.small, { color }]}>{progress}% - {progress < 30 ? 'Good' : progress < 60 ? 'Fair' : progress < 80 ? 'Worn' : 'Critical'}</Text>
										</View>

										<View style={styles.cardRight}>
											<TouchableOpacity style={styles.doneBtn} onPress={() => markDone(it.key)}>
												<Ionicons name="checkmark-done-outline" size={20} color={colors.ivory1} />
											</TouchableOpacity>
										</View>
									</View>
								);
							})}
						</View>
					))}
				</ScrollView>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.ivory4,
		padding: spacing.medium,
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.orangeShade7,
		marginBottom: spacing.small,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.orangeShade6,
		marginTop: spacing.medium,
		marginBottom: spacing.small,
	},
	kmRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.small,
	},
	// Tab styles
	tabContainer: {
		flexDirection: 'row',
		backgroundColor: colors.ivory1,
		borderRadius: 12,
		padding: 4,
		marginBottom: spacing.medium,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	tab: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 10,
		gap: 6,
	},
	tabActive: {
		backgroundColor: colors.primary + '15',
	},
	tabText: {
		fontSize: 13,
		fontWeight: '600',
		color: colors.orangeShade5,
	},
	tabTextActive: {
		color: colors.primary,
	},
	kmInput: {
		flex: 1,
		backgroundColor: colors.ivory1,
		padding: spacing.small,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	saveBtn: {
		marginLeft: spacing.small,
		backgroundColor: colors.primary,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	saveText: {
		color: colors.ivory1,
		marginLeft: 6,
		fontWeight: '600',
	},
	group: {
		marginTop: spacing.medium,
	},
	groupTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.orangeShade6,
		marginBottom: spacing.small,
	},
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.ivory1,
		padding: spacing.small,
		borderRadius: 10,
		marginBottom: spacing.small,
		borderWidth: 1,
		borderColor: colors.ivory3,
		position: 'relative',
	},
	statusIndicator: {
		width: 4,
		height: '100%',
		position: 'absolute',
		left: 0,
		top: 0,
		borderTopLeftRadius: 10,
		borderBottomLeftRadius: 10,
	},
	cardLeft: { flex: 1, paddingLeft: 8 },
	cardRight: {
		marginLeft: spacing.small,
		alignItems: 'center',
	},
	itemName: { fontWeight: '700', color: colors.orangeShade7 },
	itemNotes: { fontSize: 12, color: colors.orangeShade5, marginBottom: 6 },
	small: { fontSize: 12, color: colors.orangeShade5 },
	barBackground: {
		height: 8,
		backgroundColor: '#eee',
		borderRadius: 6,
		overflow: 'hidden',
		marginTop: spacing.small,
		marginBottom: spacing.xsmall,
	},
	barFill: {
		height: 8,
		backgroundColor: colors.primary,
	},
	doneBtn: {
		backgroundColor: '#28a745',
		padding: 8,
		borderRadius: 8,
	},
	odometerRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: colors.ivory1,
		padding: spacing.small,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.ivory3,
		marginBottom: spacing.medium,
	},
	odometerLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: colors.orangeShade6,
	},
	odometerValue: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.orangeShade7,
	},
	alertBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: spacing.small,
		borderRadius: 8,
		marginBottom: spacing.medium,
	},
	criticalBanner: {
		backgroundColor: '#DC2626',
	},
	wornBanner: {
		backgroundColor: '#F59E0B',
	},
	alertText: {
		flex: 1,
		color: '#FFF',
		fontSize: 13,
		fontWeight: '600',
		marginLeft: 8,
	},
	alertButton: {
		padding: 8,
		backgroundColor: 'rgba(255,255,255,0.2)',
		borderRadius: 6,
	},
});

export default MaintenanceTracker;