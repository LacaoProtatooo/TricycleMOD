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

// Reading/measurement dropdown options per maintenance item key
export const READING_OPTIONS_BY_KEY = {
	tire_pressure: {
		label: 'Tire Pressure Status',
		options: [
			{ value: 'normal', label: 'Normal (28–35 PSI) — Properly inflated' },
			{ value: 'slightly_low', label: 'Slightly Low (22–27 PSI) — Needs air' },
			{ value: 'low', label: 'Low (<22 PSI) — Underinflated' },
			{ value: 'overinflated', label: 'Overinflated (>40 PSI) — Too much air' },
			{ value: 'adjusted', label: 'Adjusted — Corrected to proper PSI' },
		],
	},
	chain: {
		label: 'Chain Condition',
		options: [
			{ value: 'good', label: 'Good — Proper tension, lubricated' },
			{ value: 'loose', label: 'Loose — Needs tightening' },
			{ value: 'tight', label: 'Tight — Over-tensioned' },
			{ value: 'dry', label: 'Dry — Needs lubrication' },
			{ value: 'rusty', label: 'Rusty — Corrosion present' },
			{ value: 'stretched', label: 'Stretched — Worn out, needs replacement' },
			{ value: 'adjusted_lubed', label: 'Adjusted & Lubricated — Done' },
			{ value: 'replaced', label: 'Replaced — New chain installed' },
		],
	},
	battery_water: {
		label: 'Battery Water Level',
		options: [
			{ value: 'full', label: 'Full — At proper level' },
			{ value: 'slightly_low', label: 'Slightly Low — Topped up' },
			{ value: 'low', label: 'Low — Below minimum, topped up' },
			{ value: 'dry', label: 'Dry — Was empty, refilled' },
			{ value: 'sealed', label: 'Sealed/MF — No maintenance needed' },
		],
	},
	air_filter_clean: {
		label: 'Air Filter Condition',
		options: [
			{ value: 'clean', label: 'Clean — Good airflow' },
			{ value: 'dusty', label: 'Dusty — Cleaned with air' },
			{ value: 'oily', label: 'Oily — Cleaned and re-oiled' },
			{ value: 'clogged', label: 'Clogged — Needs replacement soon' },
			{ value: 'cleaned', label: 'Cleaned — Dust/debris removed' },
		],
	},
	brake_check: {
		label: 'Brake System Condition',
		options: [
			{ value: 'good', label: 'Good — Pads/shoes have life left' },
			{ value: 'worn', label: 'Worn — Getting thin, monitor closely' },
			{ value: 'thin', label: 'Thin — Replace soon' },
			{ value: 'worn_out', label: 'Worn Out — Needs immediate replacement' },
			{ value: 'adjusted', label: 'Adjusted — Brakes adjusted' },
			{ value: 'replaced', label: 'Replaced — New pads/shoes installed' },
		],
	},
	cables: {
		label: 'Cable Condition',
		options: [
			{ value: 'good', label: 'Good — Smooth response' },
			{ value: 'sticky', label: 'Sticky — Sluggish return' },
			{ value: 'frayed', label: 'Frayed — Wire damage visible' },
			{ value: 'lubricated', label: 'Lubricated — Cables lubed' },
			{ value: 'adjusted', label: 'Adjusted — Free play corrected' },
			{ value: 'replaced', label: 'Replaced — New cable installed' },
		],
	},
	engine_oil: {
		label: 'Oil Condition',
		options: [
			{ value: 'clean', label: 'Clean — Fresh golden color' },
			{ value: 'slightly_used', label: 'Slightly Used — Amber/light brown' },
			{ value: 'dirty', label: 'Dirty — Dark brown' },
			{ value: 'very_dirty', label: 'Very Dirty — Black, was overdue' },
			{ value: 'replaced', label: 'Replaced — New oil applied' },
		],
	},
	spark_plug: {
		label: 'Spark Plug Condition',
		options: [
			{ value: 'good', label: 'Good — Clean electrode, proper gap' },
			{ value: 'worn', label: 'Worn — Electrode worn down' },
			{ value: 'fouled', label: 'Fouled — Carbon/oil deposits' },
			{ value: 'cleaned', label: 'Cleaned — Deposits removed, re-gapped' },
			{ value: 'replaced', label: 'Replaced — New plug installed' },
		],
	},
	carburetor: {
		label: 'Carburetor Condition',
		options: [
			{ value: 'good', label: 'Good — Idle & mixture normal' },
			{ value: 'rich', label: 'Rich — Running rich, adjusted' },
			{ value: 'lean', label: 'Lean — Running lean, adjusted' },
			{ value: 'dirty', label: 'Dirty — Cleaned carb body' },
			{ value: 'adjusted', label: 'Adjusted — Idle & mixture corrected' },
			{ value: 'rebuilt', label: 'Rebuilt — Gaskets/jets replaced' },
		],
	},
	chain_sprockets: {
		label: 'Chain & Sprocket Condition',
		options: [
			{ value: 'good', label: 'Good — Teeth in good shape' },
			{ value: 'worn', label: 'Worn — Teeth showing wear' },
			{ value: 'hooked', label: 'Hooked — Teeth curved, replace soon' },
			{ value: 'adjusted', label: 'Adjusted — Tension corrected' },
			{ value: 'replaced', label: 'Replaced — New chain & sprocket set' },
		],
	},
	oil_filter: {
		label: 'Oil Filter Condition',
		options: [
			{ value: 'clean', label: 'Clean — No buildup' },
			{ value: 'slightly_clogged', label: 'Slightly Clogged — Minor debris' },
			{ value: 'clogged', label: 'Clogged — Restricted flow' },
			{ value: 'replaced', label: 'Replaced — New filter installed' },
		],
	},
	air_filter_replace: {
		label: 'Air Filter Status',
		options: [
			{ value: 'clean', label: 'Clean — Still usable' },
			{ value: 'dusty', label: 'Dusty — Cleaned but aging' },
			{ value: 'worn', label: 'Worn — Was clogged/oily' },
			{ value: 'replaced', label: 'Replaced — New filter installed' },
		],
	},
	valve_clearance: {
		label: 'Valve Clearance Status',
		options: [
			{ value: 'in_spec', label: 'In Spec — Within tolerance' },
			{ value: 'tight', label: 'Tight — Was too tight, adjusted' },
			{ value: 'loose', label: 'Loose — Was too loose, adjusted' },
			{ value: 'adjusted', label: 'Adjusted — Set to proper spec' },
		],
	},
	battery_test: {
		label: 'Battery Status',
		options: [
			{ value: 'strong', label: 'Strong — Starts immediately' },
			{ value: 'ok', label: 'OK — Slight delay on start' },
			{ value: 'weak', label: 'Weak — Slow cranking' },
			{ value: 'dead', label: 'Dead — Won\'t hold charge' },
			{ value: 'charged', label: 'Charged — Battery recharged' },
			{ value: 'replaced', label: 'Replaced — New battery installed' },
		],
	},
	brake_fluid_flush: {
		label: 'Brake Fluid Status',
		options: [
			{ value: 'clear', label: 'Clear — Fresh, light yellow' },
			{ value: 'adequate', label: 'Adequate — Slightly dark' },
			{ value: 'contaminated', label: 'Contaminated — Was dark/murky' },
			{ value: 'topped_up', label: 'Topped Up — Fluid added' },
			{ value: 'flushed', label: 'Flushed & Replaced — Complete change' },
		],
	},
	clutch_plates: {
		label: 'Clutch Condition',
		options: [
			{ value: 'good', label: 'Good — Smooth engagement' },
			{ value: 'slipping', label: 'Slipping — RPM rises, speed doesn\'t' },
			{ value: 'hard', label: 'Hard — Difficult to pull' },
			{ value: 'adjusted', label: 'Adjusted — Cable/play corrected' },
			{ value: 'replaced', label: 'Replaced — New clutch plates' },
		],
	},
	suspension: {
		label: 'Suspension Condition',
		options: [
			{ value: 'good', label: 'Good — Smooth ride, no leaks' },
			{ value: 'soft', label: 'Soft — Bottoming out' },
			{ value: 'stiff', label: 'Stiff — Harsh ride' },
			{ value: 'leaking', label: 'Leaking — Oil visible on shock' },
			{ value: 'adjusted', label: 'Adjusted — Settings corrected' },
			{ value: 'replaced', label: 'Replaced — New shock absorber' },
		],
	},
	engine_overhaul: {
		label: 'Engine Overhaul Status',
		options: [
			{ value: 'good', label: 'Good — Rings, valves, gaskets OK' },
			{ value: 'worn_rings', label: 'Worn Rings — Replaced piston rings' },
			{ value: 'worn_valves', label: 'Worn Valves — Valves reseated/replaced' },
			{ value: 'gasket_replaced', label: 'Gasket Replaced — New head gasket' },
			{ value: 'full_overhaul', label: 'Full Overhaul — Complete rebuild done' },
		],
	},
	transmission_oil: {
		label: 'Transmission Oil Status',
		options: [
			{ value: 'clean', label: 'Clean — Fresh oil' },
			{ value: 'slightly_used', label: 'Slightly Used — Still OK' },
			{ value: 'dirty', label: 'Dirty — Was dark/metallic' },
			{ value: 'replaced', label: 'Replaced — New oil applied' },
		],
	},
	wiring_harness: {
		label: 'Wiring Condition',
		options: [
			{ value: 'good', label: 'Good — No damage, connections tight' },
			{ value: 'brittle', label: 'Brittle — Insulation cracking' },
			{ value: 'corroded', label: 'Corroded — Connectors cleaned' },
			{ value: 'repaired', label: 'Repaired — Broken wires fixed' },
			{ value: 'replaced', label: 'Replaced — New harness installed' },
		],
	},
};

// Default reading options for unknown/new maintenance items
export const DEFAULT_READING_OPTIONS = {
	label: 'Condition After Service',
	options: [
		{ value: 'good', label: 'Good — Working properly' },
		{ value: 'fair', label: 'Fair — Usable but monitor' },
		{ value: 'worn', label: 'Worn — Needs attention soon' },
		{ value: 'serviced', label: 'Serviced — Cleaned/adjusted' },
		{ value: 'replaced', label: 'Replaced — New part installed' },
	],
};

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
