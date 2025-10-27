import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../components/common/theme';

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

const MaintenanceTracker = (props) => {
	const [currentKm, setCurrentKm] = useState('');
	const [data, setData] = useState({}); // { itemKey: lastServiceKm }
	const [loaded, setLoaded] = useState(false);
	const [odometerKm, setOdometerKm] = useState(null);

	useEffect(() => {
		(async () => {
			try {
				const km = await AsyncStorage.getItem(KM_KEY);
				const saved = await AsyncStorage.getItem(STORAGE_KEY);
				if (km) setCurrentKm(km);
				if (saved) setData(JSON.parse(saved));
			} catch (e) {
				console.warn('MaintenanceTracker load error', e);
			} finally {
				setLoaded(true);
			}
		})();
	}, []);

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

	const markDone = async (itemKey) => {
		try {
			const kmNum = parseInt(currentKm || '0', 10);
			const next = { ...data, [itemKey]: kmNum };
			await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			setData(next);
		} catch (e) {
			console.warn('markDone error', e);
		}
	};

	const progressFor = (lastKm, intervalKm) => {
		const cur = parseInt(currentKm || '0', 10);
		const last = parseInt(lastKm || '0', 10);
		const diff = Math.max(0, cur - last);
		const pct = Math.min(100, Math.round((diff / intervalKm) * 100));
		return pct;
	};

	if (!loaded) return null;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Maintenance Tracker</Text>

			{/* manual km input removed — odometer is read-only and updated by background tracking */}

            {/* Realtime odometer */}
            <View style={styles.odometerRow}>
                <Text style={styles.odometerLabel}>Odometer</Text>
                <Text style={styles.odometerValue}>{odometerKm !== null ? `${odometerKm.toFixed(3)} km` : '—'}</Text>
            </View>

			<ScrollView
				nestedScrollEnabled={true}
				contentContainerStyle={{ paddingBottom: spacing.large }}
				showsVerticalScrollIndicator={false}
			>
				{defaultSchedule.map((group) => (
					<View key={group.id} style={styles.group}>
						<Text style={styles.groupTitle}>{group.title}</Text>
						{group.items.map((it) => {
							const last = data[it.key] || 0;
							const progress = progressFor(last, group.intervalKm);
							const dueKm = last + group.intervalKm;
							return (
								<View key={it.key} style={styles.card}>
									<View style={styles.cardLeft}>
										<Text style={styles.itemName}>{it.name}</Text>
										<Text style={styles.itemNotes}>{it.notes}</Text>
										<Text style={styles.small}>Last: {last} km · Next: {dueKm} km</Text>

										<View style={styles.barBackground}>
											<View style={[styles.barFill, { width: `${progress}%` }]} />
										</View>
										<Text style={styles.small}>{progress}% toward next service</Text>
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
	kmRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.small,
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
	},
	cardLeft: { flex: 1 },
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
});

export default MaintenanceTracker;