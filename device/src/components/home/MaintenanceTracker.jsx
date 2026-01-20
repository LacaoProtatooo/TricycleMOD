import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import VehicleDiagnostic, { getWearColor } from './VehicleDiagnostic';
import PredictiveMaintenance from './PredictiveMaintenance';
import ServiceHistory from './ServiceHistory';
import { API_URL } from '../../utils/config';

// Key for tracking which notifications have been sent
const NOTIFIED_ITEMS_KEY = 'maintenance_notified_items_v1';
const WEAR_PATTERNS_KEY = 'wear_patterns_v1';
const MAINTENANCE_HISTORY_KEY = 'maintenance_history_v2';

const BACKEND = API_URL;
const STORAGE_KEY = 'maintenance_data_v1';

// same key used in BackgroundLocationTask
const KM_KEY = 'vehicle_current_km_v1';

// Scheduled notification key
const SCHEDULED_NOTIFICATIONS_KEY = 'maintenance_scheduled_notifications_v1';

const defaultSchedule = [
	{
		id: 'weekly',
		title: 'Weekly (or every 300–500 km)',
		intervalKm: 500,
		baselineDays: 7,
		reminderLabel: 'Weekly',
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
		baselineDays: 30,
		reminderLabel: 'Monthly',
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
		baselineDays: 90,
		reminderLabel: 'Quarterly',
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
		baselineDays: 365,
		reminderLabel: 'Annual',
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
		baselineDays: 730,
		reminderLabel: 'Bi-Annual',
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
	const [lastServiceDates, setLastServiceDates] = useState({}); // { itemKey: ISODate }
	const hasCheckedNotifications = useRef(false);
	const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'predictive' | 'history'
	const [wearPatterns, setWearPatterns] = useState({});
	const [plateNumber, setPlateNumber] = useState(null);

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
			
			// Also create a channel for scheduled reminders
			await Notifications.setNotificationChannelAsync('maintenance-reminders', {
				name: 'Scheduled Maintenance Reminders',
				description: 'Periodic reminders to check maintenance items',
				importance: Notifications.AndroidImportance.DEFAULT,
				sound: 'default',
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

	// Schedule periodic maintenance reminder notifications
	const scheduleMaintenanceReminders = async (serviceDates) => {
		try {
			// Cancel all existing scheduled maintenance notifications first
			const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
			const maintenanceNotifs = allScheduled.filter(n => 
				n.content.data?.type === 'scheduled_maintenance_reminder'
			);
			for (const notif of maintenanceNotifs) {
				await Notifications.cancelScheduledNotificationAsync(notif.identifier);
			}

			const now = Date.now();
			const scheduledIds = {};

			// Schedule notifications for each maintenance group based on their interval
			for (const group of defaultSchedule) {
				const { baselineDays, reminderLabel, items } = group;
				if (!baselineDays || !reminderLabel) continue;

				// Collect items that need attention in this group
				const itemsNeedingCheck = [];
				for (const item of items) {
					const lastDate = serviceDates[item.key];
					if (lastDate) {
						const daysSince = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24));
						const daysRemaining = baselineDays - daysSince;
						
						// Schedule reminder when approaching due date (at 80% of interval)
						if (daysRemaining <= Math.ceil(baselineDays * 0.2) && daysRemaining > 0) {
							itemsNeedingCheck.push({ ...item, daysRemaining });
						}
						// If overdue, add to immediate check list
						if (daysRemaining <= 0) {
							itemsNeedingCheck.push({ ...item, daysRemaining, overdue: true });
						}
					} else {
						// No service date recorded - schedule a reminder to check
						itemsNeedingCheck.push({ ...item, noRecord: true });
					}
				}

				// Schedule a group notification if there are items needing attention
				if (itemsNeedingCheck.length > 0) {
					const overdueItems = itemsNeedingCheck.filter(i => i.overdue);
					const upcomingItems = itemsNeedingCheck.filter(i => !i.overdue && !i.noRecord);
					const noRecordItems = itemsNeedingCheck.filter(i => i.noRecord);

					let body = '';
					if (overdueItems.length > 0) {
						body += `OVERDUE: ${overdueItems.map(i => i.name).join(', ')}. `;
					}
					if (upcomingItems.length > 0) {
						body += `Due soon: ${upcomingItems.map(i => `${i.name} (${i.daysRemaining}d)`).join(', ')}. `;
					}
					if (noRecordItems.length > 0 && noRecordItems.length <= 3) {
						body += `Please check: ${noRecordItems.map(i => i.name).join(', ')}`;
					}

					if (body) {
						// Schedule for 8 AM tomorrow
						const tomorrow = new Date();
						tomorrow.setDate(tomorrow.getDate() + 1);
						tomorrow.setHours(8, 0, 0, 0);

						const notifId = await Notifications.scheduleNotificationAsync({
							content: {
								title: `🔧 ${reminderLabel} Maintenance Check`,
								body: body.trim(),
								data: { type: 'scheduled_maintenance_reminder', groupId: group.id },
								sound: 'default',
							},
							trigger: {
								date: tomorrow,
								channelId: 'maintenance-reminders',
							},
						});
						scheduledIds[group.id] = notifId;
					}
				}

				// Also schedule recurring reminders based on interval
				// Weekly = every 7 days, Monthly = every 30 days, etc.
				const nextReminderDays = Math.min(baselineDays, 7); // Cap at weekly for frequent reminders
				const nextReminderDate = new Date();
				nextReminderDate.setDate(nextReminderDate.getDate() + nextReminderDays);
				nextReminderDate.setHours(8, 0, 0, 0);

				const recurringId = await Notifications.scheduleNotificationAsync({
					content: {
						title: `📋 ${reminderLabel} Maintenance Reminder`,
						body: `Time for your ${reminderLabel.toLowerCase()} maintenance check! Review ${items.length} items: ${items.slice(0, 3).map(i => i.name).join(', ')}${items.length > 3 ? '...' : ''}`,
						data: { type: 'scheduled_maintenance_reminder', groupId: group.id, recurring: true },
						sound: 'default',
					},
					trigger: {
						date: nextReminderDate,
						channelId: 'maintenance-reminders',
					},
				});
				scheduledIds[`${group.id}_recurring`] = recurringId;
			}

			// Save scheduled notification IDs
			const storageKey = tricycleId 
				? `${SCHEDULED_NOTIFICATIONS_KEY}_${tricycleId}` 
				: SCHEDULED_NOTIFICATIONS_KEY;
			await AsyncStorage.setItem(storageKey, JSON.stringify(scheduledIds));

			console.log('Scheduled maintenance reminders:', Object.keys(scheduledIds).length);
		} catch (e) {
			console.warn('Error scheduling maintenance reminders:', e);
		}
	};

	// Re-schedule notifications when lastServiceDates changes
	useEffect(() => {
		if (loaded && Object.keys(lastServiceDates).length >= 0) {
			scheduleMaintenanceReminders(lastServiceDates);
		}
	}, [loaded, lastServiceDates, tricycleId]);

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
				
				// Create a unique key for this notification cycle (km-based)
				const notifyKey = `${item.key}_${lastKm}`;
				let isKmCritical = false;
				let isKmWorn = false;
				if (progress >= 80) isKmCritical = true;
				else if (progress >= 60) isKmWorn = true;
				
				// Time-based checks
				let isTimeCritical = false;
				let isTimeWorn = false;
				const baselineDays = group.baselineDays || null;
				const lastDateIso = lastServiceDates[item.key];
				let timeProgress = 0;
				if (baselineDays && lastDateIso) {
					const daysSince = Math.floor((Date.now() - new Date(lastDateIso)) / (1000 * 60 * 60 * 24));
					timeProgress = Math.min(100, Math.round((daysSince / baselineDays) * 100));
					if (timeProgress >= 100) isTimeCritical = true;
					else if (timeProgress >= 80) isTimeWorn = true;
				}
				
				// Prepare notification keys to avoid duplicates
				const timeNotifyKey = lastDateIso ? `time_${item.key}_${lastDateIso}` : null;
				
				// Decide notifications: prefer critical if either km or time critical
				if ((isKmCritical || isTimeCritical) && !newNotifiedItems[notifyKey] && !(timeNotifyKey && newNotifiedItems[timeNotifyKey])) {
					criticalItems.push({ ...item, progress, group: group.title, reason: { km: isKmCritical, time: isTimeCritical, timeProgress } });
					newNotifiedItems[notifyKey] = Date.now();
					if (timeNotifyKey) newNotifiedItems[timeNotifyKey] = Date.now();
				} else if ((isKmWorn || isTimeWorn) && !newNotifiedItems[`worn_${notifyKey}`] && !(timeNotifyKey && newNotifiedItems[`worn_${timeNotifyKey}`])) {
					wornItems.push({ ...item, progress, group: group.title, reason: { km: isKmWorn, time: isTimeWorn, timeProgress } });
					newNotifiedItems[`worn_${notifyKey}`] = Date.now();
					if (timeNotifyKey) newNotifiedItems[`worn_${timeNotifyKey}`] = Date.now();
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

			// 5. Build last service dates map (prefer server, then local history)
			const lastDates = {};
			if (serverHistory && Array.isArray(serverHistory)) {
				serverHistory.forEach(log => {
					if (log.itemKey && log.completedAt) {
						const prev = lastDates[log.itemKey];
						const d = new Date(log.completedAt);
						if (!prev || new Date(prev) < d) lastDates[log.itemKey] = d.toISOString();
					}
				});
			}

			const historyKey = tricycleId ? `${MAINTENANCE_HISTORY_KEY}_${tricycleId}` : MAINTENANCE_HISTORY_KEY;
			const historyStr = await AsyncStorage.getItem(historyKey);
			if (historyStr) {
				try {
					const historyArr = JSON.parse(historyStr);
					historyArr.forEach(h => {
						const k = h.itemKey || h.item;
						const dateStr = h.date || h.completedAt || h.timestamp;
						if (k && dateStr) {
							const prev = lastDates[k];
							const d = new Date(dateStr);
							if (!prev || new Date(prev) < d) lastDates[k] = d.toISOString();
						}
					});
				} catch (e) {
					// ignore parse errors
				}
			}

			setLastServiceDates(lastDates);
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

			// Update lastServiceDates locally so time-based checks pick this up immediately
			try {
				const updatedDates = { ...lastServiceDates, [itemKey]: new Date().toISOString() };
				setLastServiceDates(updatedDates);
			} catch (e) {
				// ignore
			}
			
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
			const lastDate = lastServiceDates[item.key] || null;
			let timeProgress = 0;
			if (group.baselineDays && lastDate) {
				const days = Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
				timeProgress = Math.min(100, Math.round((days / group.baselineDays) * 100));
			}
			partsStatus[item.key] = {
				progress,
				lastService: last,
				lastServiceDate: lastDate,
				nextService: last + group.intervalKm,
				nextServiceDate: lastDate && group.baselineDays ? new Date(new Date(lastDate).getTime() + group.baselineDays * 24 * 60 * 60 * 1000).toISOString() : null,
				name: item.name,
				timeProgress
			};
			
			if (progress >= 80 || timeProgress >= 100) criticalCount++;
			else if (progress >= 60 || timeProgress >= 80) wornCount++;
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
                <Text style={styles.odometerValue}>{odometerKm !== null ? `${Math.round(odometerKm)} km` : '—'}</Text>
            </View>

			{/* Tab Switcher */}
			<View style={styles.tabContainer}>
				<TouchableOpacity 
					style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
					onPress={() => setActiveTab('schedule')}
				>
					<Ionicons 
						name="list-outline" 
						size={16} 
						color={activeTab === 'schedule' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
						Schedule
					</Text>
				</TouchableOpacity>
				<TouchableOpacity 
					style={[styles.tab, activeTab === 'history' && styles.tabActive]}
					onPress={() => setActiveTab('history')}
				>
					<Ionicons 
						name="document-text-outline" 
						size={16} 
						color={activeTab === 'history' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
						History
					</Text>
				</TouchableOpacity>
				<TouchableOpacity 
					style={[styles.tab, activeTab === 'predictive' && styles.tabActive]}
					onPress={() => setActiveTab('predictive')}
				>
					<Ionicons 
						name="analytics-outline" 
						size={16} 
						color={activeTab === 'predictive' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'predictive' && styles.tabTextActive]}>
						AI
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

			{/* Service History Tab Content */}
			{activeTab === 'history' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: spacing.large }}
					showsVerticalScrollIndicator={false}
				>
					<ServiceHistory 
						tricycleId={tricycleId}
						plateNumber={plateNumber}
						maintenanceData={data}
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
	groupHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: spacing.small,
	},
	groupTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.orangeShade6,
		flex: 1,
	},
	reminderBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.primary + '15',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		gap: 4,
	},
	reminderBadgeText: {
		fontSize: 11,
		fontWeight: '600',
		color: colors.primary,
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
	small: { fontSize: 11, color: colors.orangeShade5 },
	timeInfoRow: {
		marginTop: 2,
	},
	progressSection: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 6,
		gap: 6,
	},
	progressLabel: {
		fontSize: 10,
		fontWeight: '600',
		color: colors.orangeShade5,
		width: 30,
	},
	barBackgroundSmall: {
		flex: 1,
		height: 6,
		backgroundColor: '#eee',
		borderRadius: 4,
		overflow: 'hidden',
	},
	barFillSmall: {
		height: 6,
	},
	progressPercent: {
		fontSize: 10,
		fontWeight: '600',
		width: 32,
		textAlign: 'right',
	},
	statusText: {
		fontSize: 11,
		fontWeight: '700',
		marginTop: 6,
	},
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