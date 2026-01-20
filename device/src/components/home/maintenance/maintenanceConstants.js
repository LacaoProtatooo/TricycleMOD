// Maintenance tracker constants and configuration

// Storage keys
export const NOTIFIED_ITEMS_KEY = 'maintenance_notified_items_v1';
export const WEAR_PATTERNS_KEY = 'wear_patterns_v1';
export const MAINTENANCE_HISTORY_KEY = 'maintenance_history_v2';
export const KM_KEY = 'vehicle_current_km_v1';
export const SCHEDULED_NOTIFICATIONS_KEY = 'maintenance_scheduled_notifications_v1';
export const SKIP_REASONS_KEY = 'maintenance_skip_reasons_v1';
export const MAINTENANCE_CONFIG_KEY = 'maintenance_config_cache_v1';

// Fallback skip reason options (used when server is unavailable)
export const FALLBACK_SKIP_REASON_OPTIONS = [
	{ id: 'no_funds', label: 'Insufficient funds', icon: 'wallet-outline' },
	{ id: 'no_time', label: 'No time available', icon: 'time-outline' },
	{ id: 'parts_unavailable', label: 'Parts not available', icon: 'construct-outline' },
	{ id: 'shop_closed', label: 'Repair shop closed', icon: 'business-outline' },
	{ id: 'scheduled_later', label: 'Scheduled for later', icon: 'calendar-outline' },
	{ id: 'other', label: 'Other reason', icon: 'ellipsis-horizontal-outline' },
];

// Fallback completion status options (used when server is unavailable)
export const FALLBACK_COMPLETION_STATUS_OPTIONS = [
	{ id: 'completed', label: 'Completed', icon: 'checkmark-circle' },
	{ id: 'replaced', label: 'Replaced', icon: 'swap-horizontal' },
	{ id: 'repaired', label: 'Repaired', icon: 'build' },
	{ id: 'adjusted', label: 'Adjusted', icon: 'options' },
	{ id: 'inspected', label: 'Inspected Only', icon: 'eye' },
];

// Fallback maintenance schedule (used when server is unavailable)
export const FALLBACK_SCHEDULE = [
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
