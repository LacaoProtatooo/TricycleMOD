import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { colors } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import VehicleDiagnostic, { getWearColor } from './VehicleDiagnostic';
import { predictNextService, detectAnomalies, calculateHealthScore, MAINTENANCE_ITEMS } from './PredictiveMaintenance';
import ServiceHistory from './ServiceHistory';
import RideExperienceSurvey from './RideExperienceSurvey';
import { API_URL } from '../../utils/config';

// Import from maintenance module
import {
	OverdueCheckModal,
	SkipReasonModal,
	CompletionModal,
	MaintenanceScheduleList,
	styles,
	FALLBACK_SCHEDULE,
	FALLBACK_SKIP_REASON_OPTIONS,
	FALLBACK_COMPLETION_STATUS_OPTIONS,
	NOTIFIED_ITEMS_KEY,
	WEAR_PATTERNS_KEY,
	MAINTENANCE_HISTORY_KEY,
	KM_KEY,
	SCHEDULED_NOTIFICATIONS_KEY,
	SKIP_REASONS_KEY,
	MAINTENANCE_CONFIG_KEY,
} from './maintenance';

// Maximum number of times a driver can defer maintenance per item
const MAX_DEFERRALS = 3;

const BACKEND = API_URL;

const MaintenanceTracker = ({ tricycleId, serverHistory }) => {
	const db = useAsyncSQLiteContext();
	const [currentKm, setCurrentKm] = useState('');
	const [data, setData] = useState({}); // { itemKey: lastServiceKm }
	const [loaded, setLoaded] = useState(false);
	const [odometerKm, setOdometerKm] = useState(null);
	const [notifiedItems, setNotifiedItems] = useState({}); // Track which items have been notified
	const [lastServiceDates, setLastServiceDates] = useState({}); // { itemKey: ISODate }
	const hasCheckedNotifications = useRef(false);
	const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'history' | 'checkup'
	const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'critical' | 'attention'
	const [wearPatterns, setWearPatterns] = useState({});
	const [plateNumber, setPlateNumber] = useState(null);
	
	// Manual odometer input state
	const [odometerModalVisible, setOdometerModalVisible] = useState(false);
	const [manualOdometer, setManualOdometer] = useState('');
	const [savingOdometer, setSavingOdometer] = useState(false);
	
	// Dynamic maintenance configuration from server
	const [maintenanceSchedule, setMaintenanceSchedule] = useState(FALLBACK_SCHEDULE);
	const [skipReasonOptions, setSkipReasonOptions] = useState(FALLBACK_SKIP_REASON_OPTIONS);
	const [completionStatusOptions, setCompletionStatusOptions] = useState(FALLBACK_COMPLETION_STATUS_OPTIONS);
	const [configLoaded, setConfigLoaded] = useState(false);
	
	// Skip/defer maintenance state
	const [skipReasons, setSkipReasons] = useState({}); // { itemKey: { reason, reasonId, date, daysOverdue } }
	const [skipModalVisible, setSkipModalVisible] = useState(false);
	const [skipModalItem, setSkipModalItem] = useState(null); // { key, name, daysOverdue, group }
	const [overdueCheckModalVisible, setOverdueCheckModalVisible] = useState(false);
	const [overdueItems, setOverdueItems] = useState([]);
	const hasCheckedOverdue = useRef(false);
	
	// Maintenance completion modal state
	const [completionModalVisible, setCompletionModalVisible] = useState(false);
	const [completionItem, setCompletionItem] = useState(null); // { key, name, notes, group }
	const [maintenanceRecords, setMaintenanceRecords] = useState({}); // { itemKey: [{ status, reading, notes, cost, date, km }] }

	// Ride diagnostic (checkup) data for feeding into AI predictions
	// Maps part keys to diagnostic severity/trend data from checkup surveys
	const [rideDiagnosticMap, setRideDiagnosticMap] = useState({}); // { partKey: { symptomSeverity, trend, occurrences, recentIssues } }
	const [lastCheckupDate, setLastCheckupDate] = useState(null);

	// Fetch maintenance configuration from server
	const fetchMaintenanceConfig = async () => {
		try {
			const token = await getToken(db);
			const response = await fetch(`${BACKEND}/api/maintenance/config`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (response.ok) {
				const config = await response.json();
				
				// Update state with server config
				if (config.schedule && config.schedule.length > 0) {
					setMaintenanceSchedule(config.schedule);
				}
				if (config.skipReasons && config.skipReasons.length > 0) {
					setSkipReasonOptions(config.skipReasons);
				}
				if (config.completionStatuses && config.completionStatuses.length > 0) {
					setCompletionStatusOptions(config.completionStatuses);
				}
				
				// Cache config in AsyncStorage for offline use
				await AsyncStorage.setItem(MAINTENANCE_CONFIG_KEY, JSON.stringify(config));
				console.log('Maintenance config loaded from server');
			} else {
				throw new Error('Failed to fetch config from server');
			}
		} catch (error) {
			console.warn('Error fetching maintenance config from server:', error);
			
			// Try to load from cache
			try {
				const cachedConfig = await AsyncStorage.getItem(MAINTENANCE_CONFIG_KEY);
				if (cachedConfig) {
					const config = JSON.parse(cachedConfig);
					if (config.schedule && config.schedule.length > 0) {
						setMaintenanceSchedule(config.schedule);
					}
					if (config.skipReasons && config.skipReasons.length > 0) {
						setSkipReasonOptions(config.skipReasons);
					}
					if (config.completionStatuses && config.completionStatuses.length > 0) {
						setCompletionStatusOptions(config.completionStatuses);
					}
					console.log('Maintenance config loaded from cache');
				} else {
					console.log('Using fallback maintenance config');
				}
			} catch (cacheError) {
				console.warn('Error loading cached config:', cacheError);
				console.log('Using fallback maintenance config');
			}
		} finally {
			setConfigLoaded(true);
		}
	};

	// Load maintenance config on mount
	useEffect(() => {
		fetchMaintenanceConfig();
		loadRideDiagnosticMap();
	}, []);

	// Load cached ride diagnostic data for AI predictions
	const loadRideDiagnosticMap = async () => {
		try {
			const key = tricycleId ? `ride_diagnostic_map_${tricycleId}` : 'ride_diagnostic_map_local';
			const saved = await AsyncStorage.getItem(key);
			if (saved) {
				const parsed = JSON.parse(saved);
				setRideDiagnosticMap(parsed.map || {});
				setLastCheckupDate(parsed.lastDate || null);
			}
		} catch (e) {
			console.warn('Error loading ride diagnostic map:', e);
		}
	};

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
			for (const group of maintenanceSchedule) {
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
					const overdueItemsList = itemsNeedingCheck.filter(i => i.overdue);
					const upcomingItems = itemsNeedingCheck.filter(i => !i.overdue && !i.noRecord);
					const noRecordItems = itemsNeedingCheck.filter(i => i.noRecord);

					let body = '';
					if (overdueItemsList.length > 0) {
						body += `OVERDUE: ${overdueItemsList.map(i => i.name).join(', ')}. `;
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
		
		maintenanceSchedule.forEach(group => {
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
		
		maintenanceSchedule.forEach(group => {
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
		// Check current defer count for this item
		const currentDeferCount = skipReasons[item.key]?.deferCount || 0;
		
		if (currentDeferCount >= MAX_DEFERRALS) {
			Alert.alert(
				'Defer Limit Reached',
				`You have already deferred "${item.name}" ${MAX_DEFERRALS} times. This maintenance must be completed now.\n\nPlease complete the maintenance or contact your operator for assistance.`,
				[
					{ text: 'Complete Now', onPress: () => handleCompleteFromOverdue(item) },
					{ text: 'Cancel', style: 'cancel' }
				]
			);
			return;
		}
		
		// Pass current defer count to modal
		setSkipModalItem({ ...item, deferCount: currentDeferCount });
		setSkipModalVisible(true);
	};

	// Submit skip reason (from SkipReasonModal)
	const handleSubmitSkipReason = async ({ reasonId, reason }) => {
		if (!skipModalItem) return;
		
		// Calculate new defer count
		const currentDeferCount = skipModalItem.deferCount || 0;
		const newDeferCount = currentDeferCount + 1;
		const remainingDefers = MAX_DEFERRALS - newDeferCount;
		
		const newSkipReasons = {
			...skipReasons,
			[skipModalItem.key]: {
				reasonId: reasonId,
				reason: reason,
				date: new Date().toISOString(),
				daysOverdue: skipModalItem.daysOverdue,
				kmOverdue: skipModalItem.kmOverdue,
				deferCount: newDeferCount, // Track defer count
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
		
		// Sync to server (will handle operator notification on 2nd+ defer)
		if (tricycleId && db) {
			try {
				const token = await getToken(db);
				await fetch(`${BACKEND}/api/maintenance/tricycle/${tricycleId}/skip`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body: JSON.stringify({
						itemKey: skipModalItem.key,
						itemName: skipModalItem.name,
						reasonId,
						reason,
						daysOverdue: skipModalItem.daysOverdue,
						kmOverdue: skipModalItem.kmOverdue,
						deferCount: newDeferCount,
					})
				});
			} catch (e) {
				console.warn('Error syncing skip to server:', e);
			}
		}
		
		// Remove from overdue list
		setOverdueItems(prev => prev.filter(i => i.key !== skipModalItem.key));
		
		setSkipModalVisible(false);
		
		// Build alert message based on defer count
		let alertTitle = 'Acknowledged';
		let alertMessage = `Maintenance for "${skipModalItem.name}" has been deferred.\nReason: ${reason}`;
		
		if (remainingDefers === 0) {
			alertTitle = '⚠️ Final Deferral';
			alertMessage += `\n\n🚨 This was your last deferral for this item. You must complete this maintenance next time.`;
		} else if (remainingDefers === 1) {
			alertTitle = '⚠️ Warning';
			alertMessage += `\n\n⚠️ You have 1 deferral remaining for this item. Your operator has been notified.`;
		} else {
			alertMessage += `\n\n📋 Deferrals remaining: ${remainingDefers}/${MAX_DEFERRALS}`;
		}
		
		alertMessage += '\n\nPlease complete this maintenance as soon as possible.';
		
		Alert.alert(alertTitle, alertMessage, [{ text: 'OK' }]);
		
		setSkipModalItem(null);
	};

	// ==================== MANUAL ODOMETER UPDATE ====================
	const openOdometerModal = () => {
		setManualOdometer(odometerKm ? String(Math.round(odometerKm)) : '');
		setOdometerModalVisible(true);
	};

	const handleSaveManualOdometer = async () => {
		const newOdometer = parseFloat(manualOdometer);
		
		if (isNaN(newOdometer) || newOdometer < 0) {
			Alert.alert('Invalid Input', 'Please enter a valid odometer reading.');
			return;
		}
		
		// Prevent setting odometer lower than current reading
		if (odometerKm && newOdometer < odometerKm) {
			Alert.alert(
				'Invalid Reading',
				`The new reading (${Math.round(newOdometer)} km) cannot be lower than the current reading (${Math.round(odometerKm)} km). Odometer values can only increase.`
			);
			return;
		}
		
		await saveOdometerReading(newOdometer);
	};

	const saveOdometerReading = async (newOdometer) => {
		setSavingOdometer(true);
		
		try {
			// Save to local storage first
			await AsyncStorage.setItem(KM_KEY, String(newOdometer));
			setOdometerKm(newOdometer);
			setCurrentKm(String(newOdometer));
			
			// Sync to server if we have a tricycle ID
			if (tricycleId) {
				try {
					const token = await getToken(db);
					const response = await fetch(`${BACKEND}/api/tricycles/${tricycleId}/odometer`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${token}`
						},
						body: JSON.stringify({ odometer: newOdometer })
					});
					
					const result = await response.json();
					if (!result.success) {
						console.warn('Server odometer update failed:', result.message);
					}
				} catch (serverError) {
					console.warn('Failed to sync odometer to server:', serverError);
					// Still successful locally, show partial success message
				}
			}
			
			setOdometerModalVisible(false);
			Alert.alert(
				'Success',
				`Odometer updated to ${Math.round(newOdometer)} km`,
				[{ text: 'OK' }]
			);
		} catch (error) {
			console.error('Error saving odometer:', error);
			Alert.alert('Error', 'Failed to save odometer reading. Please try again.');
		} finally {
			setSavingOdometer(false);
		}
	};

	// Handle completing maintenance from overdue check (opens detailed modal)
	const handleCompleteFromOverdue = (item) => {
		setOverdueCheckModalVisible(false);
		// Find the group for this item
		for (const group of maintenanceSchedule) {
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
			// 1. Calculate state from serverHistory - ONLY use approved records
			let serverState = {};
			if (serverHistory && Array.isArray(serverHistory)) {
				serverHistory
					.filter(log => log.approvalStatus === 'approved' || !log.approvalStatus) // Include approved or legacy records without status
					.forEach(log => {
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

			// 5. Build last service dates map - include pending records for time tracking
			// Time-based progress needs to track from when maintenance was performed,
			// regardless of approval status, so drivers see accurate time progress.
			const lastDates = {};
			if (serverHistory && Array.isArray(serverHistory)) {
				serverHistory
					.filter(log => log.approvalStatus !== 'rejected') // Include approved + pending, exclude rejected
					.forEach(log => {
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
						// Include all non-rejected records for time tracking
						if (k && dateStr && h.approvalStatus !== 'rejected') {
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

			// 6. Build maintenanceRecords from serverHistory (INCLUDING pending records for display)
			const records = {};
			if (serverHistory && Array.isArray(serverHistory)) {
				serverHistory.forEach(log => {
					const k = log.itemKey;
					if (k) {
						if (!records[k]) records[k] = [];
						records[k].push({
							status: log.status || 'completed',
							reading: log.reading || null,
							notes: log.notes || null,
							cost: log.cost || null,
							km: log.lastServiceKm,
							date: log.completedAt || log.createdAt,
							approvalStatus: log.approvalStatus || 'approved',
						});
					}
				});
				// Sort each item's records by date descending and keep last 10
				Object.keys(records).forEach(k => {
					records[k].sort((a, b) => new Date(b.date) - new Date(a.date));
					if (records[k].length > 10) {
						records[k] = records[k].slice(0, 10);
					}
				});
			}
			setMaintenanceRecords(records);
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

	// Function to save to server
	const saveToServer = async (itemKey, lastServiceKm, maintenanceDetails) => {
		if (!tricycleId || !db) return { approvalStatus: 'approved' }; // Local only, auto-approve
		try {
			const token = await getToken(db);
			const response = await fetch(`${BACKEND}/api/maintenance/tricycle/${tricycleId}/log`, {
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
					proofImage: maintenanceDetails.proofImage || null,
				})
			});
			
			if (response.ok) {
				const result = await response.json();
				return { approvalStatus: result.approvalStatus || 'pending' };
			}
			return { approvalStatus: 'pending' };
		} catch (error) {
			console.error("Failed to sync maintenance to server", error);
			return { approvalStatus: 'pending' };
		}
	};

	// Open completion modal to record maintenance details
	const openCompletionModal = (item, group) => {
		setCompletionItem({ ...item, group: group.title, groupId: group.id });
		setCompletionModalVisible(true);
	};

	// Submit maintenance completion with full details (from CompletionModal)
	const handleSubmitCompletion = async (maintenanceDetails) => {
		if (!completionItem) return;
		
		const itemKey = completionItem.key;
		const now = new Date();
		const completedAt = maintenanceDetails.completedAt;
		
		try {
			const kmNum = parseInt(odometerKm || currentKm || '0', 10);
			const previousKm = data[itemKey] || 0;
			
			// Sync to server first to get approval status
			const serverResult = await saveToServer(itemKey, kmNum, maintenanceDetails);
			const approvalStatus = serverResult.approvalStatus || 'pending';
			const isPending = approvalStatus === 'pending';
			
			// Always update lastServiceDates so time-based tracking works immediately
			// (even for pending records — time tracking should reflect when work was done)
			const updatedDates = { ...lastServiceDates, [itemKey]: completedAt };
			setLastServiceDates(updatedDates);

			// Only update KM data / local state if approved (operator submitted) or if offline/local
			if (!isPending || !tricycleId) {
				const next = { ...data, [itemKey]: kmNum };
				
				// Save to dynamic key
				const key = tricycleId ? `maintenance_data_${tricycleId}` : 'maintenance_data_local';
				await AsyncStorage.setItem(key, JSON.stringify(next));
				setData(next);
				
				// Track wear pattern for AI predictions
				await trackWearPattern(itemKey, kmNum, previousKm);

				// Save to maintenance history with full details
				await saveToMaintenanceHistory(itemKey, kmNum, maintenanceDetails);

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
				approvalStatus,
			});
			// Keep last 10 records per item
			if (updatedRecords[itemKey].length > 10) {
				updatedRecords[itemKey] = updatedRecords[itemKey].slice(0, 10);
			}
			setMaintenanceRecords(updatedRecords);

			// Close modal
			setCompletionModalVisible(false);
			setCompletionItem(null);
			
			// Show appropriate message based on approval status
			if (isPending && tricycleId) {
				Alert.alert(
					'Maintenance Submitted ⏳',
					`${completionItem.name}\n\nYour maintenance record has been submitted and is pending operator approval.\n\nStatus: ${maintenanceDetails.status}\n${maintenanceDetails.reading ? `Reading: ${maintenanceDetails.reading}\n` : ''}Odometer: ${kmNum} km\nDate: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n\nYou will be notified once approved.`
				);
			} else {
				Alert.alert(
					'Maintenance Recorded ✓',
					`${completionItem.name}\n\nStatus: ${maintenanceDetails.status}\n${maintenanceDetails.reading ? `Reading: ${maintenanceDetails.reading}\n` : ''}Odometer: ${kmNum} km\nDate: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
				);
			}
		} catch (e) {
			console.warn('handleSubmitCompletion error', e);
			Alert.alert('Error', 'Failed to record maintenance. Please try again.');
		}
	};

	const markDone = async (itemKey) => {
		// Find the item and group to open detailed modal
		for (const group of maintenanceSchedule) {
			const item = group.items.find(i => i.key === itemKey);
			if (item) {
				openCompletionModal(item, group);
				return;
			}
		}
	};

	// Track wear patterns for predictive maintenance AI
	const trackWearPattern = async (itemKey, currentKmVal, previousServiceKm) => {
		try {
			const patternsKey = tricycleId ? `${WEAR_PATTERNS_KEY}_${tricycleId}` : WEAR_PATTERNS_KEY;
			const currentPatterns = { ...wearPatterns };
			
			if (!currentPatterns[itemKey]) {
				currentPatterns[itemKey] = [];
			}
			
			// Calculate wear level based on km since last service
			const kmSinceService = currentKmVal - previousServiceKm;
			const itemSchedule = maintenanceSchedule.find(g => g.items.find(i => i.key === itemKey));
			const expectedInterval = itemSchedule?.intervalKm || 1000;
			const wearLevel = Math.min(100, (kmSinceService / expectedInterval) * 100);
			
			// Add data point
			currentPatterns[itemKey].push({
				km: currentKmVal,
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
			for (const group of maintenanceSchedule) {
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
	
	maintenanceSchedule.forEach(group => {
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

	// ==================== AI PREDICTIVE ANALYSIS (integrated into schedule) ====================
	const aiPredictions = useMemo(() => {
		const result = {};
		maintenanceSchedule.forEach(group => {
			group.items.forEach(item => {
				const lastServiceKm = data[item.key] || 0;
				const itemHistory = wearPatterns[item.key] || [];
				const lastDate = lastServiceDates[item.key] || null;
				// Build per-item maintenance history from serverHistory for adaptive learning
				const itemMaintenanceHistory = serverHistory && Array.isArray(serverHistory)
					? serverHistory.filter(h =>
						(h.itemKey === item.key || h.item === item.key) &&
						(h.approvalStatus === 'approved' || !h.approvalStatus)
					)
					: [];
				// Get ride diagnostic data for this part from checkup surveys
				const diagnosticData = rideDiagnosticMap[item.key] || null;
				const prediction = predictNextService(
					item.key,
					odometerKm || 0,
					lastServiceKm,
					itemHistory,
					itemMaintenanceHistory,
					lastDate,
					diagnosticData
				);
				if (prediction) {
					result[item.key] = prediction;
				}
			});
		});
		return result;
	}, [data, odometerKm, wearPatterns, maintenanceSchedule, lastServiceDates, serverHistory, rideDiagnosticMap]);

	const aiAnomalies = useMemo(() => {
		return detectAnomalies(wearPatterns, odometerKm || 0);
	}, [wearPatterns, odometerKm]);

	const healthScore = useMemo(() => {
		return calculateHealthScore(data, odometerKm || 0, aiPredictions, lastServiceDates);
	}, [data, odometerKm, aiPredictions, lastServiceDates]);

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
		const group = maintenanceSchedule.find(g => g.items.find(i => i.key === itemKey));
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

	/**
	 * Handle ride checkup completion — bridges checkup survey data into
	 * the scheduled maintenance + AI predictive maintenance systems.
	 * 
	 * This converts symptom-level issues (e.g., "brakes squealing") into
	 * part-level wear data (e.g., brake_check severity boost) that the
	 * predictive AI can consume for better predictions.
	 */
	const handleDiagnosticsComplete = async (issues) => {
		if (!issues || issues.length === 0) {
			console.log('Ride checkup completed with no issues');
			return;
		}

		console.log(`Ride diagnostic found ${issues.length} issue(s) — feeding into AI predictions`);

		try {
			// 1. Build a map of part keys → diagnostic severity data from the checkup
			const updatedDiagMap = { ...rideDiagnosticMap };
			const now = Date.now();

			issues.forEach(issue => {
				// Each issue has a .parts array with maintenance part keys
				const partsToUpdate = issue.parts || [];
				partsToUpdate.forEach(partKey => {
					if (!updatedDiagMap[partKey]) {
						updatedDiagMap[partKey] = {
							symptomSeverity: 0,
							trend: 'stable',
							occurrences: 0,
							recentIssues: [],
						};
					}

					const entry = updatedDiagMap[partKey];

					// Update max severity (take the worst reported symptom)
					entry.symptomSeverity = Math.max(entry.symptomSeverity, issue.severity || 0);

					// Track occurrence count
					entry.occurrences = (entry.occurrences || 0) + 1;

					// Keep recent issues list (last 10)
					if (!entry.recentIssues) entry.recentIssues = [];
					entry.recentIssues.unshift({
						symptom: issue.symptom || issue.symptomId,
						severity: issue.severity || 0,
						urgency: issue.urgency || 'low',
						categoryId: issue.categoryId,
						date: new Date().toISOString(),
					});
					if (entry.recentIssues.length > 10) {
						entry.recentIssues = entry.recentIssues.slice(0, 10);
					}

					// Determine trend based on recent severity history
					if (entry.recentIssues.length >= 2) {
						const recentSevs = entry.recentIssues.slice(0, Math.ceil(entry.recentIssues.length / 2)).map(r => r.severity);
						const olderSevs = entry.recentIssues.slice(Math.ceil(entry.recentIssues.length / 2)).map(r => r.severity);
						const recentAvg = recentSevs.reduce((a, b) => a + b, 0) / recentSevs.length;
						const olderAvg = olderSevs.length > 0 ? olderSevs.reduce((a, b) => a + b, 0) / olderSevs.length : recentAvg;
						entry.trend = recentAvg > olderAvg + 0.3 ? 'worsening' : recentAvg < olderAvg - 0.3 ? 'improving' : 'stable';
					}
				});
			});

			// 2. Update state so AI predictions recalculate with diagnostic data
			setRideDiagnosticMap(updatedDiagMap);
			setLastCheckupDate(new Date().toISOString());

			// 3. Persist to AsyncStorage for cross-session learning
			const storageKey = tricycleId ? `ride_diagnostic_map_${tricycleId}` : 'ride_diagnostic_map_local';
			await AsyncStorage.setItem(storageKey, JSON.stringify({
				map: updatedDiagMap,
				lastDate: new Date().toISOString(),
			}));

			// 4. Boost wear patterns for parts flagged with high severity
			// This creates additional data points for the regression model
			const currentKmVal = parseInt(odometerKm || currentKm || '0', 10);
			if (currentKmVal > 0) {
				const updatedPatterns = { ...wearPatterns };
				let patternsChanged = false;

				issues.forEach(issue => {
					const partsToUpdate = issue.parts || [];
					partsToUpdate.forEach(partKey => {
						if (issue.severity >= 2) {
							// Find the expected interval for this part
							const itemSchedule = maintenanceSchedule.find(g => g.items.find(i => i.key === partKey));
							const expectedInterval = itemSchedule?.intervalKm || 1000;
							const lastServiceKm = data[partKey] || 0;
							const kmSinceService = Math.max(0, currentKmVal - lastServiceKm);

							// Calculate an elevated wear level based on symptom severity
							// Normal wear would be (kmSinceService / expectedInterval) * 100
							// Symptom-boosted wear adds severity_percentage to reflect reported issues
							const baseWear = Math.min(100, (kmSinceService / expectedInterval) * 100);
							const severityBoost = issue.severity * 8; // severity 3 = +24%, severity 5 = +40%
							const boostedWear = Math.min(100, baseWear + severityBoost);

							if (!updatedPatterns[partKey]) {
								updatedPatterns[partKey] = [];
							}

							updatedPatterns[partKey].push({
								km: currentKmVal,
								wearLevel: boostedWear,
								kmSinceLastService: kmSinceService,
								timestamp: now,
								source: 'ride_checkup', // Tag data source for the AI engine
								severity: issue.severity,
								symptom: issue.symptom || issue.symptomId,
							});

							// Keep only last 20 data points per item
							if (updatedPatterns[partKey].length > 20) {
								updatedPatterns[partKey] = updatedPatterns[partKey].slice(-20);
							}
							patternsChanged = true;
						}
					});
				});

				if (patternsChanged) {
					setWearPatterns(updatedPatterns);
					const patternsKey = tricycleId ? `${WEAR_PATTERNS_KEY}_${tricycleId}` : WEAR_PATTERNS_KEY;
					await AsyncStorage.setItem(patternsKey, JSON.stringify(updatedPatterns));
					console.log('Wear patterns updated from checkup data for AI training');
				}
			}

			console.log(`Diagnostic map updated: ${Object.keys(updatedDiagMap).length} parts tracked`);
		} catch (e) {
			console.warn('handleDiagnosticsComplete error:', e);
		}
	};

	if (!loaded) return null;

	return (
		<View style={styles.container}>
			{/* Overdue Maintenance Check Modal */}
			<OverdueCheckModal
				visible={overdueCheckModalVisible}
				onClose={() => setOverdueCheckModalVisible(false)}
				overdueItems={overdueItems}
				onComplete={handleCompleteFromOverdue}
				onSkip={(item) => {
					setOverdueCheckModalVisible(false);
					handleSkipMaintenance(item);
				}}
			/>

			{/* Skip Reason Modal */}
			<SkipReasonModal
				visible={skipModalVisible}
				onClose={() => setSkipModalVisible(false)}
				item={skipModalItem}
				onSubmit={handleSubmitSkipReason}
				onCancel={() => {
					setSkipModalVisible(false);
					setOverdueCheckModalVisible(true);
				}}
				skipReasonOptions={skipReasonOptions}
				maxDefers={MAX_DEFERRALS}
			/>

			{/* Maintenance Completion Modal */}
			<CompletionModal
				visible={completionModalVisible}
				onClose={() => {
					setCompletionModalVisible(false);
					setCompletionItem(null);
				}}
				item={completionItem}
				odometerKm={odometerKm}
				onSubmit={handleSubmitCompletion}
				statusOptions={completionStatusOptions}
			/>

			{/* Manual Odometer Input Modal */}
			<Modal
				visible={odometerModalVisible}
				transparent={false}
				animationType="slide"
				onRequestClose={() => setOdometerModalVisible(false)}
			>
				<View style={{
					flex: 1,
					backgroundColor: colors.ivory1,
				}}>
					{/* Header */}
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
						paddingHorizontal: 16,
						paddingVertical: 14,
						borderBottomWidth: 1,
						borderBottomColor: colors.ivory3,
						backgroundColor: colors.ivory1,
					}}>
						<TouchableOpacity
							onPress={() => setOdometerModalVisible(false)}
							style={{
								width: 36,
								height: 36,
								alignItems: 'center',
								justifyContent: 'center',
								borderRadius: 18,
								backgroundColor: colors.ivory2,
							}}
						>
							<Ionicons name="close" size={22} color={colors.orangeShade7} />
						</TouchableOpacity>
						<Text style={{ fontSize: 18, fontWeight: '700', color: colors.orangeShade7 }}>
							Update Odometer
						</Text>
						<View style={{ width: 36 }} />
					</View>

					{/* Body */}
					<View style={{ flex: 1, padding: 20 }}>
						{/* Current Reading Card */}
						<View style={{
							alignItems: 'center',
							backgroundColor: colors.ivory4 || '#f8f8f8',
							borderRadius: 16,
							paddingVertical: 28,
							marginBottom: 24,
							borderWidth: 1,
							borderColor: colors.ivory3,
						}}>
							<Ionicons name="speedometer" size={48} color={colors.primary} />
							<Text style={{
								fontSize: 44,
								fontWeight: '800',
								color: colors.orangeShade7,
								marginTop: 10,
							}}>
								{odometerKm !== null ? Math.round(odometerKm).toLocaleString() : '—'}
							</Text>
							<Text style={{ fontSize: 16, color: colors.orangeShade5, marginTop: 4 }}>
								kilometers
							</Text>
						</View>

						{/* Input Section */}
						<View style={{
							backgroundColor: colors.ivory4 || '#f8f8f8',
							borderRadius: 12,
							padding: 16,
							marginBottom: 16,
							borderWidth: 1,
							borderColor: colors.ivory3,
						}}>
							<Text style={{ fontSize: 16, fontWeight: '700', color: colors.orangeShade7, marginBottom: 6 }}>
								Set New Reading
							</Text>
							<Text style={{ fontSize: 13, color: colors.orangeShade5, lineHeight: 18, marginBottom: 14 }}>
								Enter the current odometer reading from your tricycle's dashboard.
							</Text>
							<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
								<TextInput
									style={{
										flex: 1,
										backgroundColor: colors.ivory1,
										borderRadius: 10,
										paddingHorizontal: 14,
										paddingVertical: 12,
										fontSize: 18,
										fontWeight: '600',
										color: colors.orangeShade7,
										borderWidth: 1,
										borderColor: colors.ivory3,
									}}
									value={manualOdometer}
									onChangeText={setManualOdometer}
									keyboardType="numeric"
									placeholder="Enter kilometers"
									placeholderTextColor={colors.orangeShade4}
									editable={!savingOdometer}
								/>
								<Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '600', color: colors.orangeShade5 }}>
									km
								</Text>
							</View>

							{/* Action Buttons */}
							<View style={{ flexDirection: 'row', gap: 10 }}>
								<TouchableOpacity
									style={{
										flex: 1,
										flexDirection: 'row',
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: colors.ivory2 || '#eee',
										paddingVertical: 12,
										borderRadius: 10,
										borderWidth: 1,
										borderColor: colors.ivory3,
									}}
									onPress={() => setOdometerModalVisible(false)}
									disabled={savingOdometer}
								>
									<Text style={{ fontSize: 15, fontWeight: '600', color: colors.orangeShade7 }}>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={{
										flex: 1,
										flexDirection: 'row',
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: colors.primary,
										paddingVertical: 12,
										borderRadius: 10,
										opacity: savingOdometer ? 0.7 : 1,
									}}
									onPress={handleSaveManualOdometer}
									disabled={savingOdometer}
								>
									{savingOdometer ? (
										<ActivityIndicator size="small" color="#fff" />
									) : (
										<>
											<Ionicons name="checkmark-circle" size={20} color="#fff" />
											<Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>Save</Text>
										</>
									)}
								</TouchableOpacity>
							</View>
						</View>

					</View>
				</View>
			</Modal>

			<Text style={styles.title}>Maintenance Tracker</Text>

			{/* Realtime odometer with edit button */}
			<TouchableOpacity 
				style={styles.odometerRow}
				onPress={openOdometerModal}
				activeOpacity={0.7}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Ionicons name="speedometer-outline" size={18} color={colors.orangeShade6} style={{ marginRight: 6 }} />
					<Text style={styles.odometerLabel}>Odometer</Text>
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Text style={styles.odometerValue}>{odometerKm !== null ? `${Math.round(odometerKm)} km` : '—'}</Text>
					<Ionicons name="create-outline" size={18} color={colors.primary} style={{ marginLeft: 8 }} />
				</View>
			</TouchableOpacity>

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
					style={[styles.tab, activeTab === 'checkup' && styles.tabActive]}
					onPress={() => setActiveTab('checkup')}
				>
					<Ionicons 
						name="medkit-outline" 
						size={16} 
						color={activeTab === 'checkup' ? colors.primary : colors.orangeShade5} 
					/>
					<Text style={[styles.tabText, activeTab === 'checkup' && styles.tabTextActive]}>
						Checkup
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
			</View>

			{/* Critical/Worn Summary Banner */}
			{(criticalCount > 0 || wornCount > 0) && (
				<TouchableOpacity 
					activeOpacity={0.8}
					onPress={() => {
						setActiveTab('schedule');
						setScheduleFilter(criticalCount > 0 ? 'critical' : 'attention');
					}}
					style={[
						styles.alertBanner, 
						criticalCount > 0 ? styles.criticalBanner : styles.wornBanner
					]}
				>
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
					<View style={styles.alertButton}>
						<Ionicons name="funnel" size={16} color="#FFF" />
					</View>
				</TouchableOpacity>
			)}

			{/* Clear Filter button right below the alert banner */}
			{scheduleFilter !== 'all' && (
				<TouchableOpacity
					activeOpacity={0.7}
					onPress={() => setScheduleFilter('all')}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: scheduleFilter === 'critical' ? '#DC262612' : '#F59E0B12',
						borderWidth: 1,
						borderColor: scheduleFilter === 'critical' ? '#DC262630' : '#F59E0B30',
						borderRadius: 10,
						paddingHorizontal: 14,
						paddingVertical: 8,
						marginTop: 6,
					}}
				>
					<Ionicons name="close-circle" size={16} color={scheduleFilter === 'critical' ? '#DC2626' : '#F59E0B'} />
					<Text style={{
						fontSize: 13,
						fontWeight: '600',
						color: scheduleFilter === 'critical' ? '#DC2626' : '#D97706',
						marginLeft: 6,
					}}>
						Clear Filter — Show All Items
					</Text>
				</TouchableOpacity>
			)}

			{!tricycleId && (
				<Text style={{color: 'red', marginBottom: 10, fontSize: 12}}>
					No tricycle assigned. Data will be saved locally only.
				</Text>
			)}

			{/* Ride Checkup Tab Content */}
			{activeTab === 'checkup' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: 20 }}
					showsVerticalScrollIndicator={false}
				>
					<RideExperienceSurvey 
						tricycleId={tricycleId}
						onDiagnosticsComplete={handleDiagnosticsComplete}
						maintenanceSchedule={maintenanceSchedule}
						maintenanceData={data}
						aiPredictions={aiPredictions}
						aiAnomalies={aiAnomalies}
						healthScore={healthScore}
						odometerKm={odometerKm}
						lastServiceDates={lastServiceDates}
						rideDiagnosticMap={rideDiagnosticMap}
					/>
				</ScrollView>
			)}

			{/* Service History Tab Content */}
			{activeTab === 'history' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: 20 }}
					showsVerticalScrollIndicator={false}
				>
					<ServiceHistory 
						tricycleId={tricycleId}
						plateNumber={plateNumber}
						maintenanceData={data}
						serverHistory={serverHistory}
					/>
				</ScrollView>
			)}

			{/* Schedule Tab Content */}
			{activeTab === 'schedule' && (
				<ScrollView
					nestedScrollEnabled={true}
					contentContainerStyle={{ paddingBottom: 20 }}
					showsVerticalScrollIndicator={false}
				>
					{/* Vehicle Diagnostic View */}
					<VehicleDiagnostic partsStatus={partsStatus} />
					
					{/* Detailed List View */}
					<MaintenanceScheduleList
						data={data}
						lastServiceDates={lastServiceDates}
						skipReasons={skipReasons}
						odometerKm={odometerKm}
						currentKm={currentKm}
						onMarkDone={markDone}
						onDefer={handleSkipMaintenance}
						schedule={maintenanceSchedule}
						filter={scheduleFilter}
						onClearFilter={() => setScheduleFilter('all')}
						predictions={aiPredictions}
						anomalies={aiAnomalies}
						healthScore={healthScore}
						onMaintenanceNeeded={handleMaintenanceNeeded}
						maintenanceRecords={maintenanceRecords}
					/>
				</ScrollView>
			)}
		</View>
	);
};

export default MaintenanceTracker;
