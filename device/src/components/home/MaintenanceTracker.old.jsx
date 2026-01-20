import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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

// Skip/defer reasons storage key
const SKIP_REASONS_KEY = 'maintenance_skip_reasons_v1';

// Common reasons for skipping maintenance
const SKIP_REASON_OPTIONS = [
	{ id: 'no_funds', label: 'Insufficient funds', icon: 'wallet-outline' },
	{ id: 'no_time', label: 'No time available', icon: 'time-outline' },
	{ id: 'parts_unavailable', label: 'Parts not available', icon: 'construct-outline' },
	{ id: 'shop_closed', label: 'Repair shop closed', icon: 'business-outline' },
	{ id: 'scheduled_later', label: 'Scheduled for later', icon: 'calendar-outline' },
	{ id: 'other', label: 'Other reason', icon: 'ellipsis-horizontal-outline' },
];

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
	
	// Skip/defer maintenance state
	const [skipReasons, setSkipReasons] = useState({}); // { itemKey: { reason, reasonId, date, daysOverdue } }
	const [skipModalVisible, setSkipModalVisible] = useState(false);
	const [skipModalItem, setSkipModalItem] = useState(null); // { key, name, daysOverdue, group }
	const [selectedSkipReason, setSelectedSkipReason] = useState(null);
	const [customSkipReason, setCustomSkipReason] = useState('');
	const [overdueCheckModalVisible, setOverdueCheckModalVisible] = useState(false);
	const [overdueItems, setOverdueItems] = useState([]);
	const hasCheckedOverdue = useRef(false);
	
	// Maintenance completion modal state
	const [completionModalVisible, setCompletionModalVisible] = useState(false);
	const [completionItem, setCompletionItem] = useState(null); // { key, name, notes, group }
	const [completionStatus, setCompletionStatus] = useState('completed'); // 'completed' | 'replaced' | 'repaired' | 'adjusted' | 'inspected'
	const [completionReading, setCompletionReading] = useState(''); // e.g., tire pressure PSI, oil level, etc.
	const [completionNotes, setCompletionNotes] = useState('');
	const [completionCost, setCompletionCost] = useState('');
	const [maintenanceRecords, setMaintenanceRecords] = useState({}); // { itemKey: [{ status, reading, notes, cost, date, km }] }

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
		
		// Load skip reasons
		const loadSkipReasons = async () => {
			try {
				const key = tricycleId ? `${SKIP_REASONS_KEY}_${tricycleId}` : SKIP_REASONS_KEY;
				const saved = await AsyncStorage.getItem(key);
				if (saved) {
					setSkipReasons(JSON.parse(saved));
				}
			} catch (e) {
				console.warn('Error loading skip reasons:', e);
			}
		};
		loadSkipReasons();
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

	// Check for overdue items that need acknowledgment
	const checkOverdueItems = () => {
		const now = Date.now();
		const overdue = [];
		
		defaultSchedule.forEach(group => {
			group.items.forEach(item => {
				const lastDate = lastServiceDates[item.key];
				const lastKm = data[item.key] || 0;
				const currentOdo = odometerKm || 0;
				
				// Check time-based overdue
				let daysOverdue = 0;
				let kmOverdue = 0;
				let isOverdue = false;
				
				if (lastDate && group.baselineDays) {
					const daysSince = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24));
					daysOverdue = daysSince - group.baselineDays;
					if (daysOverdue > 0) isOverdue = true;
				}
				
				// Check km-based overdue
				const kmSinceService = currentOdo - lastKm;
				kmOverdue = kmSinceService - group.intervalKm;
				if (kmOverdue > 0) isOverdue = true;
				
				// Check if already acknowledged recently (within the current overdue period)
				const existingReason = skipReasons[item.key];
				const isAcknowledgedRecently = existingReason && 
					new Date(existingReason.date) > new Date(lastDate || 0);
				
				if (isOverdue && !isAcknowledgedRecently) {
					overdue.push({
						key: item.key,
						name: item.name,
						notes: item.notes,
						group: group.title,
						reminderLabel: group.reminderLabel,
						daysOverdue: Math.max(0, daysOverdue),
						kmOverdue: Math.max(0, Math.round(kmOverdue)),
						lastDate: lastDate,
						lastKm: lastKm,
					});
				}
			});
		});
		
		return overdue;
	};

	// Check for overdue items when loaded
	useEffect(() => {
		if (loaded && Object.keys(lastServiceDates).length > 0 && !hasCheckedOverdue.current) {
			hasCheckedOverdue.current = true;
			const overdue = checkOverdueItems();
			if (overdue.length > 0) {
				setOverdueItems(overdue);
				setOverdueCheckModalVisible(true);
			}
		}
	}, [loaded, lastServiceDates, data, odometerKm, skipReasons]);

	// Handle skip/defer maintenance
	const handleSkipMaintenance = (item) => {
		setSkipModalItem(item);
		setSelectedSkipReason(null);
		setCustomSkipReason('');
		setSkipModalVisible(true);
	};

	// Submit skip reason
	const submitSkipReason = async () => {
		if (!skipModalItem || !selectedSkipReason) {
			Alert.alert('Required', 'Please select a reason for skipping maintenance.');
			return;
		}
		
		if (selectedSkipReason === 'other' && !customSkipReason.trim()) {
			Alert.alert('Required', 'Please enter your reason.');
			return;
		}
		
		const reasonText = selectedSkipReason === 'other' 
			? customSkipReason.trim() 
			: SKIP_REASON_OPTIONS.find(r => r.id === selectedSkipReason)?.label || selectedSkipReason;
		
		const newSkipReasons = {
			...skipReasons,
			[skipModalItem.key]: {
				reasonId: selectedSkipReason,
				reason: reasonText,
				date: new Date().toISOString(),
				daysOverdue: skipModalItem.daysOverdue,
				kmOverdue: skipModalItem.kmOverdue,
			}
		};
		
		setSkipReasons(newSkipReasons);
		
		// Save to storage
		try {
			const key = tricycleId ? `${SKIP_REASONS_KEY}_${tricycleId}` : SKIP_REASONS_KEY;
			await AsyncStorage.setItem(key, JSON.stringify(newSkipReasons));
		} catch (e) {
			console.warn('Error saving skip reason:', e);
		}
		
		// Remove from overdue list
		setOverdueItems(prev => prev.filter(i => i.key !== skipModalItem.key));
		
		setSkipModalVisible(false);
		setSkipModalItem(null);
		setSelectedSkipReason(null);
		setCustomSkipReason('');
		
		Alert.alert(
			'Acknowledged',
			`Maintenance for "${skipModalItem.name}" has been deferred.\nReason: ${reasonText}\n\nPlease complete this maintenance as soon as possible.`,
			[{ text: 'OK' }]
		);
	};

	// Handle completing maintenance from overdue check (opens detailed modal)
	const handleCompleteFromOverdue = (item) => {
		setOverdueCheckModalVisible(false);
		// Find the group for this item
		for (const group of defaultSchedule) {
			const foundItem = group.items.find(i => i.key === item.key);
			if (foundItem) {
				openCompletionModal(foundItem, group);
				break;
			}
		}
		setOverdueItems(prev => prev.filter(i => i.key !== item.key));
	};

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
    const saveToServer = async (itemKey, lastServiceKm, maintenanceDetails) => {
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
                    notes: maintenanceDetails.notes || 'Completed via app',
                    status: maintenanceDetails.status || 'completed',
                    reading: maintenanceDetails.reading || null,
                    cost: maintenanceDetails.cost || null,
                    completedAt: maintenanceDetails.completedAt || new Date().toISOString(),
                })
            });
        } catch (error) {
            console.error("Failed to sync maintenance to server", error);
        }
    };

	// Open completion modal to record maintenance details
	const openCompletionModal = (item, group) => {
		setCompletionItem({ ...item, group: group.title, groupId: group.id });
		setCompletionStatus('completed');
		setCompletionReading('');
		setCompletionNotes('');
		setCompletionCost('');
		setCompletionModalVisible(true);
	};

	// Submit maintenance completion with full details
	const submitMaintenanceCompletion = async () => {
		if (!completionItem) return;
		
		const itemKey = completionItem.key;
		const now = new Date();
		const completedAt = now.toISOString();
		
		try {
			const kmNum = parseInt(odometerKm || currentKm || '0', 10);
			const previousKm = data[itemKey] || 0;
			const next = { ...data, [itemKey]: kmNum };
            
            // Save to dynamic key
            const key = tricycleId ? `maintenance_data_${tricycleId}` : 'maintenance_data_local';
			await AsyncStorage.setItem(key, JSON.stringify(next));
			setData(next);

			// Create maintenance details object
			const maintenanceDetails = {
				status: completionStatus,
				reading: completionReading.trim() || null,
				notes: completionNotes.trim() || `${completionStatus} via app`,
				cost: completionCost ? parseFloat(completionCost) : null,
				completedAt: completedAt,
			};

            // Sync to server with full details
            await saveToServer(itemKey, kmNum, maintenanceDetails);
			
			// Track wear pattern for AI predictions
			await trackWearPattern(itemKey, kmNum, previousKm);

			// Save to maintenance history with full details
			await saveToMaintenanceHistory(itemKey, kmNum, maintenanceDetails);

			// Update lastServiceDates locally so time-based checks pick this up immediately
			try {
				const updatedDates = { ...lastServiceDates, [itemKey]: completedAt };
				setLastServiceDates(updatedDates);
			} catch (e) {
				// ignore
			}

			// Update maintenance records state for display
			const updatedRecords = { ...maintenanceRecords };
			if (!updatedRecords[itemKey]) {
				updatedRecords[itemKey] = [];
			}
			updatedRecords[itemKey].unshift({
				...maintenanceDetails,
				km: kmNum,
				date: completedAt,
			});
			// Keep last 10 records per item
			if (updatedRecords[itemKey].length > 10) {
				updatedRecords[itemKey] = updatedRecords[itemKey].slice(0, 10);
			}
			setMaintenanceRecords(updatedRecords);

			// Clear skip reason if any
			if (skipReasons[itemKey]) {
				const updatedSkipReasons = { ...skipReasons };
				delete updatedSkipReasons[itemKey];
				setSkipReasons(updatedSkipReasons);
				const skipKey = tricycleId ? `${SKIP_REASONS_KEY}_${tricycleId}` : SKIP_REASONS_KEY;
				await AsyncStorage.setItem(skipKey, JSON.stringify(updatedSkipReasons));
			}
			
			// Clear the notification flag for this item
			const notifyKey = tricycleId ? `${NOTIFIED_ITEMS_KEY}_${tricycleId}` : NOTIFIED_ITEMS_KEY;
			const updatedNotified = { ...notifiedItems };
			Object.keys(updatedNotified).forEach(k => {
				if (k.includes(itemKey)) {
					delete updatedNotified[k];
				}
			});
			setNotifiedItems(updatedNotified);
			await AsyncStorage.setItem(notifyKey, JSON.stringify(updatedNotified));

			// Close modal
			setCompletionModalVisible(false);
			setCompletionItem(null);
			
			Alert.alert(
				'Maintenance Recorded ✓',
				`${completionItem.name}\n\nStatus: ${completionStatus}\n${completionReading ? `Reading: ${completionReading}\n` : ''}Odometer: ${kmNum} km\nDate: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
			);
		} catch (e) {
			console.warn('submitMaintenanceCompletion error', e);
			Alert.alert('Error', 'Failed to record maintenance. Please try again.');
		}
	};

	const markDone = async (itemKey) => {
		// Find the item and group to open detailed modal
		for (const group of defaultSchedule) {
			const item = group.items.find(i => i.key === itemKey);
			if (item) {
				openCompletionModal(item, group);
				return;
			}
		}
	};

	// Quick mark done (used from overdue modal)
	const quickMarkDone = async (itemKey) => {
		try {
			const kmNum = parseInt(odometerKm || currentKm || '0', 10);
			const previousKm = data[itemKey] || 0;
			const next = { ...data, [itemKey]: kmNum };
			const now = new Date();
			const completedAt = now.toISOString();
            
            const key = tricycleId ? `maintenance_data_${tricycleId}` : 'maintenance_data_local';
			await AsyncStorage.setItem(key, JSON.stringify(next));
			setData(next);

			const maintenanceDetails = {
				status: 'completed',
				reading: null,
				notes: 'Quick completed via app',
				cost: null,
				completedAt: completedAt,
			};

            await saveToServer(itemKey, kmNum, maintenanceDetails);
			await trackWearPattern(itemKey, kmNum, previousKm);
			await saveToMaintenanceHistory(itemKey, kmNum, maintenanceDetails);

			const updatedDates = { ...lastServiceDates, [itemKey]: completedAt };
			setLastServiceDates(updatedDates);
			
			const notifyKey = tricycleId ? `${NOTIFIED_ITEMS_KEY}_${tricycleId}` : NOTIFIED_ITEMS_KEY;
			const updatedNotified = { ...notifiedItems };
			Object.keys(updatedNotified).forEach(k => {
				if (k.includes(itemKey)) {
					delete updatedNotified[k];
				}
			});
			setNotifiedItems(updatedNotified);
			await AsyncStorage.setItem(notifyKey, JSON.stringify(updatedNotified));
			
			Alert.alert('Success', `Marked as maintained at ${kmNum} km on ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
		} catch (e) {
			console.warn('quickMarkDone error', e);
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

	// Save to maintenance history for analytics with full details
	const saveToMaintenanceHistory = async (itemKey, kmNum, maintenanceDetails = {}) => {
		try {
			const historyKey = tricycleId ? `${MAINTENANCE_HISTORY_KEY}_${tricycleId}` : MAINTENANCE_HISTORY_KEY;
			const historyStr = await AsyncStorage.getItem(historyKey);
			let history = historyStr ? JSON.parse(historyStr) : [];
			
			// Find item name from schedule
			let itemName = itemKey.replace(/_/g, ' ');
			let groupTitle = '';
			for (const group of defaultSchedule) {
				const item = group.items.find(i => i.key === itemKey);
				if (item) {
					itemName = item.name;
					groupTitle = group.title;
					break;
				}
			}
			
			const now = new Date();
			history.push({
				itemKey,
				itemName,
				groupTitle,
				km: kmNum,
				date: maintenanceDetails.completedAt || now.toISOString(),
				timestamp: now.getTime(),
				type: 'maintenance_completed',
				status: maintenanceDetails.status || 'completed',
				reading: maintenanceDetails.reading || null,
				notes: maintenanceDetails.notes || null,
				cost: maintenanceDetails.cost || null,
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
			{/* Overdue Maintenance Check Modal */}
			<Modal
				visible={overdueCheckModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setOverdueCheckModalVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.overdueModal}>
						<View style={styles.overdueModalHeader}>
							<Ionicons name="warning" size={32} color="#DC2626" />
							<Text style={styles.overdueModalTitle}>Maintenance Check Required</Text>
						</View>
						<Text style={styles.overdueModalSubtitle}>
							The following items are overdue. Please complete maintenance or provide a reason for deferral.
						</Text>
						
						<ScrollView style={styles.overdueList} showsVerticalScrollIndicator={false}>
							{overdueItems.map((item) => (
								<View key={item.key} style={styles.overdueItem}>
									<View style={styles.overdueItemHeader}>
										<Text style={styles.overdueItemName}>{item.name}</Text>
										<View style={styles.overdueBadge}>
											<Text style={styles.overdueBadgeText}>{item.reminderLabel}</Text>
										</View>
									</View>
									<Text style={styles.overdueItemNotes}>{item.notes}</Text>
									<View style={styles.overdueStats}>
										{item.daysOverdue > 0 && (
											<Text style={styles.overdueStatText}>
												<Ionicons name="calendar" size={12} color="#DC2626" /> {item.daysOverdue} days overdue
											</Text>
										)}
										{item.kmOverdue > 0 && (
											<Text style={styles.overdueStatText}>
												<Ionicons name="speedometer" size={12} color="#DC2626" /> {item.kmOverdue} km overdue
											</Text>
										)}
									</View>
									<View style={styles.overdueActions}>
										<TouchableOpacity 
											style={styles.completeBtn}
											onPress={() => handleCompleteFromOverdue(item)}
										>
											<Ionicons name="checkmark-circle" size={16} color="#FFF" />
											<Text style={styles.completeBtnText}>Mark Done</Text>
										</TouchableOpacity>
										<TouchableOpacity 
											style={styles.skipBtn}
											onPress={() => {
												setOverdueCheckModalVisible(false);
												handleSkipMaintenance(item);
											}}
										>
											<Ionicons name="time" size={16} color={colors.primary} />
											<Text style={styles.skipBtnText}>Defer</Text>
										</TouchableOpacity>
									</View>
								</View>
							))}
						</ScrollView>
						
						{overdueItems.length === 0 && (
							<TouchableOpacity 
								style={styles.modalCloseBtn}
								onPress={() => setOverdueCheckModalVisible(false)}
							>
								<Text style={styles.modalCloseBtnText}>Close</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>
			</Modal>

			{/* Skip Reason Modal */}
			<Modal
				visible={skipModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setSkipModalVisible(false)}
			>
				<KeyboardAvoidingView 
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={styles.modalOverlay}
				>
					<View style={styles.skipModal}>
						<View style={styles.skipModalHeader}>
							<Ionicons name="help-circle" size={28} color={colors.primary} />
							<Text style={styles.skipModalTitle}>Why is maintenance being deferred?</Text>
						</View>
						
						{skipModalItem && (
							<View style={styles.skipItemInfo}>
								<Text style={styles.skipItemName}>{skipModalItem.name}</Text>
								<Text style={styles.skipItemOverdue}>
									{skipModalItem.daysOverdue > 0 ? `${skipModalItem.daysOverdue} days overdue` : ''}
									{skipModalItem.daysOverdue > 0 && skipModalItem.kmOverdue > 0 ? ' · ' : ''}
									{skipModalItem.kmOverdue > 0 ? `${skipModalItem.kmOverdue} km overdue` : ''}
								</Text>
							</View>
						)}
						
						<Text style={styles.skipReasonLabel}>Select a reason:</Text>
						<ScrollView style={styles.skipReasonList} showsVerticalScrollIndicator={false}>
							{SKIP_REASON_OPTIONS.map((option) => (
								<TouchableOpacity
									key={option.id}
									style={[
										styles.skipReasonOption,
										selectedSkipReason === option.id && styles.skipReasonOptionSelected
									]}
									onPress={() => setSelectedSkipReason(option.id)}
								>
									<Ionicons 
										name={option.icon} 
										size={20} 
										color={selectedSkipReason === option.id ? colors.primary : colors.orangeShade5} 
									/>
									<Text style={[
										styles.skipReasonOptionText,
										selectedSkipReason === option.id && styles.skipReasonOptionTextSelected
									]}>
										{option.label}
									</Text>
									{selectedSkipReason === option.id && (
										<Ionicons name="checkmark-circle" size={20} color={colors.primary} />
									)}
								</TouchableOpacity>
							))}
						</ScrollView>
						
						{selectedSkipReason === 'other' && (
							<TextInput
								style={styles.customReasonInput}
								placeholder="Please specify your reason..."
								placeholderTextColor={colors.orangeShade4}
								value={customSkipReason}
								onChangeText={setCustomSkipReason}
								multiline
								numberOfLines={3}
							/>
						)}
						
						<View style={styles.skipModalActions}>
							<TouchableOpacity 
								style={styles.skipCancelBtn}
								onPress={() => {
									setSkipModalVisible(false);
									setOverdueCheckModalVisible(true);
								}}
							>
								<Text style={styles.skipCancelBtnText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity 
								style={[
									styles.skipSubmitBtn,
									!selectedSkipReason && styles.skipSubmitBtnDisabled
								]}
								onPress={submitSkipReason}
								disabled={!selectedSkipReason}
							>
								<Text style={styles.skipSubmitBtnText}>Submit</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Maintenance Completion Modal */}
			<Modal
				visible={completionModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setCompletionModalVisible(false)}
			>
				<KeyboardAvoidingView 
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={styles.modalOverlay}
				>
					<ScrollView contentContainerStyle={styles.completionModalScroll}>
						<View style={styles.completionModal}>
							<View style={styles.completionModalHeader}>
								<Ionicons name="construct" size={28} color="#22C55E" />
								<Text style={styles.completionModalTitle}>Record Maintenance</Text>
							</View>
							
							{completionItem && (
								<View style={styles.completionItemInfo}>
									<Text style={styles.completionItemName}>{completionItem.name}</Text>
									<Text style={styles.completionItemGroup}>{completionItem.group}</Text>
									<Text style={styles.completionItemNotes}>{completionItem.notes}</Text>
								</View>
							)}
							
							{/* Current readings display */}
							<View style={styles.currentReadingsBox}>
								<View style={styles.readingRow}>
									<Ionicons name="speedometer-outline" size={16} color={colors.orangeShade6} />
									<Text style={styles.readingLabel}>Current Odometer:</Text>
									<Text style={styles.readingValue}>{odometerKm !== null ? `${Math.round(odometerKm)} km` : '—'}</Text>
								</View>
								<View style={styles.readingRow}>
									<Ionicons name="calendar-outline" size={16} color={colors.orangeShade6} />
									<Text style={styles.readingLabel}>Date & Time:</Text>
									<Text style={styles.readingValue}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</Text>
								</View>
							</View>

							{/* Status Selection */}
							<Text style={styles.completionLabel}>Maintenance Status *</Text>
							<View style={styles.statusOptionsRow}>
								{[
									{ id: 'completed', label: 'Completed', icon: 'checkmark-circle' },
									{ id: 'replaced', label: 'Replaced', icon: 'swap-horizontal' },
									{ id: 'repaired', label: 'Repaired', icon: 'build' },
									{ id: 'adjusted', label: 'Adjusted', icon: 'options' },
									{ id: 'inspected', label: 'Inspected', icon: 'eye' },
								].map((opt) => (
									<TouchableOpacity
										key={opt.id}
										style={[
											styles.statusOption,
											completionStatus === opt.id && styles.statusOptionSelected
										]}
										onPress={() => setCompletionStatus(opt.id)}
									>
										<Ionicons 
											name={opt.icon} 
											size={18} 
											color={completionStatus === opt.id ? '#FFF' : colors.orangeShade5} 
										/>
										<Text style={[
											styles.statusOptionText,
											completionStatus === opt.id && styles.statusOptionTextSelected
										]}>
											{opt.label}
										</Text>
									</TouchableOpacity>
								))}
							</View>

							{/* Reading/Measurement Input */}
							<Text style={styles.completionLabel}>Reading / Measurement (optional)</Text>
							<TextInput
								style={styles.completionInput}
								placeholder="e.g., 32 PSI, 3.5L oil, 0.8mm gap..."
								placeholderTextColor={colors.orangeShade4}
								value={completionReading}
								onChangeText={setCompletionReading}
							/>

							{/* Cost Input */}
							<Text style={styles.completionLabel}>Cost (optional)</Text>
							<TextInput
								style={styles.completionInput}
								placeholder="e.g., 150"
								placeholderTextColor={colors.orangeShade4}
								value={completionCost}
								onChangeText={setCompletionCost}
								keyboardType="numeric"
							/>

							{/* Notes Input */}
							<Text style={styles.completionLabel}>Notes / Details (optional)</Text>
							<TextInput
								style={[styles.completionInput, styles.completionTextArea]}
								placeholder="Additional details about the maintenance performed..."
								placeholderTextColor={colors.orangeShade4}
								value={completionNotes}
								onChangeText={setCompletionNotes}
								multiline
								numberOfLines={3}
							/>

							<View style={styles.completionModalActions}>
								<TouchableOpacity 
									style={styles.completionCancelBtn}
									onPress={() => {
										setCompletionModalVisible(false);
										setCompletionItem(null);
									}}
								>
									<Text style={styles.completionCancelBtnText}>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity 
									style={styles.completionSubmitBtn}
									onPress={submitMaintenanceCompletion}
								>
									<Ionicons name="checkmark" size={18} color="#FFF" />
									<Text style={styles.completionSubmitBtnText}>Record</Text>
								</TouchableOpacity>
							</View>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</Modal>

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
											<TouchableOpacity style={styles.doneBtn} onPress={() => markDone(it.key)}>
												<Ionicons name="checkmark-done-outline" size={18} color={colors.ivory1} />
											</TouchableOpacity>
											{/* Show defer button for overdue items */}
											{(daysRemaining !== null && daysRemaining < 0) || progress >= 100 ? (
												<TouchableOpacity 
													style={styles.deferBtn} 
													onPress={() => handleSkipMaintenance({
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
		marginBottom: 6,
	},
	deferBtn: {
		backgroundColor: colors.ivory2,
		padding: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	deferredReasonBox: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FEF3C7',
		padding: 6,
		borderRadius: 6,
		marginTop: 6,
		gap: 4,
	},
	deferredReasonText: {
		fontSize: 10,
		color: '#92400E',
		flex: 1,
	},
	deferredDateText: {
		fontSize: 9,
		color: '#B45309',
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
	// Modal styles
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: spacing.medium,
	},
	overdueModal: {
		backgroundColor: colors.ivory1,
		borderRadius: 16,
		padding: spacing.large,
		width: '100%',
		maxHeight: '85%',
	},
	overdueModalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.small,
		gap: 10,
	},
	overdueModalTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#DC2626',
		flex: 1,
	},
	overdueModalSubtitle: {
		fontSize: 13,
		color: colors.orangeShade5,
		marginBottom: spacing.medium,
		lineHeight: 18,
	},
	overdueList: {
		maxHeight: 400,
	},
	overdueItem: {
		backgroundColor: colors.ivory2,
		borderRadius: 12,
		padding: spacing.medium,
		marginBottom: spacing.small,
		borderWidth: 1,
		borderColor: '#FCA5A5',
	},
	overdueItemHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	overdueItemName: {
		fontSize: 15,
		fontWeight: '700',
		color: colors.orangeShade7,
		flex: 1,
	},
	overdueBadge: {
		backgroundColor: '#FEE2E2',
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 10,
	},
	overdueBadgeText: {
		fontSize: 10,
		fontWeight: '600',
		color: '#DC2626',
	},
	overdueItemNotes: {
		fontSize: 12,
		color: colors.orangeShade5,
		marginBottom: 8,
	},
	overdueStats: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 10,
	},
	overdueStatText: {
		fontSize: 11,
		color: '#DC2626',
		fontWeight: '600',
	},
	overdueActions: {
		flexDirection: 'row',
		gap: 10,
	},
	completeBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#22C55E',
		paddingVertical: 10,
		borderRadius: 8,
		gap: 6,
	},
	completeBtnText: {
		color: '#FFF',
		fontWeight: '600',
		fontSize: 13,
	},
	skipBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.ivory1,
		paddingVertical: 10,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.primary,
		gap: 6,
	},
	skipBtnText: {
		color: colors.primary,
		fontWeight: '600',
		fontSize: 13,
	},
	modalCloseBtn: {
		backgroundColor: colors.primary,
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: spacing.medium,
	},
	modalCloseBtnText: {
		color: '#FFF',
		fontWeight: '600',
		fontSize: 14,
	},
	// Skip Modal styles
	skipModal: {
		backgroundColor: colors.ivory1,
		borderRadius: 16,
		padding: spacing.large,
		width: '100%',
		maxHeight: '80%',
	},
	skipModalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.medium,
		gap: 10,
	},
	skipModalTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.orangeShade7,
		flex: 1,
	},
	skipItemInfo: {
		backgroundColor: colors.ivory2,
		padding: spacing.small,
		borderRadius: 8,
		marginBottom: spacing.medium,
	},
	skipItemName: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.orangeShade7,
	},
	skipItemOverdue: {
		fontSize: 12,
		color: '#DC2626',
		marginTop: 2,
	},
	skipReasonLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: colors.orangeShade6,
		marginBottom: spacing.small,
	},
	skipReasonList: {
		maxHeight: 220,
	},
	skipReasonOption: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: spacing.small,
		backgroundColor: colors.ivory2,
		borderRadius: 8,
		marginBottom: 8,
		gap: 10,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	skipReasonOptionSelected: {
		backgroundColor: colors.primary + '10',
		borderColor: colors.primary,
	},
	skipReasonOptionText: {
		flex: 1,
		fontSize: 14,
		color: colors.orangeShade6,
	},
	skipReasonOptionTextSelected: {
		color: colors.primary,
		fontWeight: '600',
	},
	customReasonInput: {
		backgroundColor: colors.ivory2,
		borderRadius: 8,
		padding: spacing.small,
		borderWidth: 1,
		borderColor: colors.ivory3,
		marginTop: spacing.small,
		fontSize: 14,
		color: colors.orangeShade7,
		minHeight: 80,
		textAlignVertical: 'top',
	},
	skipModalActions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: spacing.medium,
	},
	skipCancelBtn: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		backgroundColor: colors.ivory2,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	skipCancelBtnText: {
		color: colors.orangeShade6,
		fontWeight: '600',
		fontSize: 14,
	},
	skipSubmitBtn: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		backgroundColor: colors.primary,
	},
	skipSubmitBtnDisabled: {
		backgroundColor: colors.orangeShade3,
	},
	skipSubmitBtnText: {
		color: '#FFF',
		fontWeight: '600',
		fontSize: 14,
	},
	// Completion Modal styles
	completionModalScroll: {
		flexGrow: 1,
		justifyContent: 'center',
		padding: spacing.medium,
	},
	completionModal: {
		backgroundColor: colors.ivory1,
		borderRadius: 16,
		padding: spacing.large,
		width: '100%',
	},
	completionModalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.medium,
		gap: 10,
	},
	completionModalTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#22C55E',
		flex: 1,
	},
	completionItemInfo: {
		backgroundColor: colors.ivory2,
		padding: spacing.medium,
		borderRadius: 10,
		marginBottom: spacing.medium,
		borderLeftWidth: 4,
		borderLeftColor: '#22C55E',
	},
	completionItemName: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.orangeShade7,
	},
	completionItemGroup: {
		fontSize: 12,
		color: colors.primary,
		marginTop: 2,
	},
	completionItemNotes: {
		fontSize: 12,
		color: colors.orangeShade5,
		marginTop: 4,
		fontStyle: 'italic',
	},
	currentReadingsBox: {
		backgroundColor: '#F0FDF4',
		padding: spacing.small,
		borderRadius: 8,
		marginBottom: spacing.medium,
		borderWidth: 1,
		borderColor: '#BBF7D0',
	},
	readingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 8,
	},
	readingLabel: {
		fontSize: 12,
		color: colors.orangeShade5,
		flex: 1,
	},
	readingValue: {
		fontSize: 12,
		fontWeight: '600',
		color: colors.orangeShade7,
	},
	completionLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: colors.orangeShade6,
		marginBottom: 8,
		marginTop: spacing.small,
	},
	statusOptionsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: spacing.small,
	},
	statusOption: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: colors.ivory2,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: colors.ivory3,
		gap: 6,
	},
	statusOptionSelected: {
		backgroundColor: '#22C55E',
		borderColor: '#22C55E',
	},
	statusOptionText: {
		fontSize: 12,
		color: colors.orangeShade5,
		fontWeight: '500',
	},
	statusOptionTextSelected: {
		color: '#FFF',
	},
	completionInput: {
		backgroundColor: colors.ivory2,
		borderRadius: 8,
		padding: spacing.small,
		borderWidth: 1,
		borderColor: colors.ivory3,
		fontSize: 14,
		color: colors.orangeShade7,
	},
	completionTextArea: {
		minHeight: 70,
		textAlignVertical: 'top',
	},
	completionModalActions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: spacing.large,
	},
	completionCancelBtn: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 8,
		alignItems: 'center',
		backgroundColor: colors.ivory2,
		borderWidth: 1,
		borderColor: colors.ivory3,
	},
	completionCancelBtnText: {
		color: colors.orangeShade6,
		fontWeight: '600',
		fontSize: 14,
	},
	completionSubmitBtn: {
		flex: 1.5,
		flexDirection: 'row',
		paddingVertical: 14,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#22C55E',
		gap: 6,
	},
	completionSubmitBtnText: {
		color: '#FFF',
		fontWeight: '700',
		fontSize: 14,
	},
});

export default MaintenanceTracker;