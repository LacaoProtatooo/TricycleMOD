import React, { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Modal,
	Alert,
	ActivityIndicator,
	Animated,
	Dimensions,
	TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { API_URL } from '../../utils/config';
import {
	SURVEY_TRANSLATIONS,
	RATING_TL,
	CATEGORY_TL,
	DRIVING_CONDITION_TL,
	DIAGNOSTIC_TL,
} from './surveyTranslations';

const { width: screenWidth } = Dimensions.get('window');
const BACKEND = API_URL;
const SURVEY_HISTORY_KEY = 'ride_survey_history_v1';
const LAST_SURVEY_KEY = 'ride_survey_last_date_v1';

// ==================== MOTORCYCLE DIAGNOSTIC KNOWLEDGE BASE ====================
// Maps ride symptoms to motorcycle parts and recommendations

const RIDE_SURVEY_CATEGORIES = [
	{
		id: 'engine',
		title: 'Engine Performance',
		icon: 'speedometer-outline',
		question: 'How does your engine feel during your recent drives?',
		options: [
			{ id: 'smooth', label: 'Smooth & responsive', emoji: '✅', severity: 0 },
			{ id: 'rough_idle', label: 'Rough idle / vibration', emoji: '🔸', severity: 2 },
			{ id: 'hard_start', label: 'Hard to start', emoji: '🔸', severity: 2 },
			{ id: 'power_loss', label: 'Loss of power / sluggish', emoji: '🔶', severity: 3 },
			{ id: 'stalling', label: 'Stalling / dies unexpectedly', emoji: '🔴', severity: 4 },
			{ id: 'knocking', label: 'Knocking / unusual noise', emoji: '🔴', severity: 5 },
		],
	},
	{
		id: 'braking',
		title: 'Braking',
		icon: 'hand-left-outline',
		question: 'How are your brakes performing?',
		options: [
			{ id: 'firm', label: 'Responsive & firm', emoji: '✅', severity: 0 },
			{ id: 'spongy', label: 'Spongy / soft feel', emoji: '🔸', severity: 2 },
			{ id: 'squealing', label: 'Squealing / grinding noise', emoji: '🔶', severity: 3 },
			{ id: 'pulling', label: 'Pulling to one side', emoji: '🔶', severity: 3 },
			{ id: 'slow_stop', label: 'Takes longer to stop', emoji: '🔴', severity: 4 },
		],
	},
	{
		id: 'suspension',
		title: 'Ride Comfort & Suspension',
		icon: 'car-outline',
		question: 'How is the ride quality and suspension?',
		options: [
			{ id: 'comfortable', label: 'Smooth & comfortable', emoji: '✅', severity: 0 },
			{ id: 'bouncy', label: 'Bouncy / unstable', emoji: '🔸', severity: 2 },
			{ id: 'bottoming', label: 'Bottoming out on bumps', emoji: '🔶', severity: 3 },
			{ id: 'leaning', label: 'Leaning to one side', emoji: '🔶', severity: 3 },
			{ id: 'harsh', label: 'Harsh / every bump felt', emoji: '🔸', severity: 2 },
		],
	},
	{
		id: 'steering',
		title: 'Steering & Handling',
		icon: 'navigate-outline',
		question: 'How does the steering and handling feel?',
		options: [
			{ id: 'precise', label: 'Precise & predictable', emoji: '✅', severity: 0 },
			{ id: 'wobbling', label: 'Wobbling / shaking', emoji: '🔶', severity: 3 },
			{ id: 'heavy', label: 'Heavy / hard to turn', emoji: '🔸', severity: 2 },
			{ id: 'drifting', label: 'Drifting to one side', emoji: '🔶', severity: 3 },
		],
	},
	{
		id: 'transmission',
		title: 'Transmission & Clutch',
		icon: 'cog-outline',
		question: 'How are your gear shifts and clutch?',
		options: [
			{ id: 'crisp', label: 'Smooth & crisp', emoji: '✅', severity: 0 },
			{ id: 'hard_shift', label: 'Hard to shift / grinding', emoji: '🔶', severity: 3 },
			{ id: 'slipping', label: 'Clutch slipping', emoji: '🔴', severity: 4 },
			{ id: 'popping', label: 'Gears popping out', emoji: '🔴', severity: 5 },
			{ id: 'noise_shift', label: 'Unusual noise when shifting', emoji: '🔸', severity: 2 },
		],
	},
	{
		id: 'electrical',
		title: 'Electrical System',
		icon: 'flash-outline',
		question: 'How are your electrical components?',
		options: [
			{ id: 'all_fine', label: 'All working fine', emoji: '✅', severity: 0 },
			{ id: 'dim_lights', label: 'Dim headlights', emoji: '🔸', severity: 2 },
			{ id: 'battery_drain', label: 'Battery draining fast', emoji: '🔶', severity: 3 },
			{ id: 'starter_issue', label: 'Starter motor issues', emoji: '🔶', severity: 3 },
			{ id: 'flickering', label: 'Lights / signals flickering', emoji: '🔸', severity: 2 },
		],
	},
	{
		id: 'drivetrain',
		title: 'Chain & Drivetrain',
		icon: 'link-outline',
		question: 'How is the chain and drivetrain?',
		options: [
			{ id: 'quiet', label: 'Quiet & smooth', emoji: '✅', severity: 0 },
			{ id: 'chain_noise', label: 'Chain noise / clatter', emoji: '🔸', severity: 2 },
			{ id: 'chain_slip', label: 'Chain slipping off', emoji: '🔴', severity: 4 },
			{ id: 'chain_vibration', label: 'Vibration from chain area', emoji: '🔶', severity: 3 },
		],
	},
	{
		id: 'exhaust',
		title: 'Exhaust & Emissions',
		icon: 'cloud-outline',
		question: 'Any exhaust issues noticed?',
		options: [
			{ id: 'normal', label: 'Normal exhaust', emoji: '✅', severity: 0 },
			{ id: 'white_smoke', label: 'Excessive white smoke', emoji: '🔶', severity: 3 },
			{ id: 'blue_smoke', label: 'Blue / grey smoke', emoji: '🔴', severity: 4 },
			{ id: 'black_smoke', label: 'Black smoke', emoji: '🔶', severity: 3 },
			{ id: 'loud_exhaust', label: 'Loud / unusual exhaust noise', emoji: '🔸', severity: 2 },
		],
	},
];

// Motorcycle diagnostic recommendations
// Maps symptom IDs to parts to check and actions to take
const MOTORCYCLE_DIAGNOSTICS = {
	// Engine
	rough_idle: {
		parts: ['spark_plug', 'carburetor', 'air_filter_clean', 'valve_clearance'],
		title: 'Rough Idle / Vibration',
		description: 'Common when carburetor mixture is off or spark plug is fouled.',
		actions: [
			{ part: 'Spark Plug', action: 'Clean or replace. Check gap is 0.7–0.8mm. Use recommended plug for your model.', icon: 'flash' },
			{ part: 'Carburetor (Keihin PB18)', action: 'Clean jets, check idle screw (1.5 turns out from seated). Adjust pilot air screw.', icon: 'construct' },
			{ part: 'Air Filter', action: 'Clean foam element with soap & water, re-oil lightly. Replace if torn.', icon: 'funnel' },
			{ part: 'Valve Clearance', action: 'Adjust to spec per your motorcycle manual. Use feeler gauge.', icon: 'options' },
		],
		urgency: 'medium',
	},
	hard_start: {
		parts: ['spark_plug', 'battery_test', 'carburetor', 'engine_oil'],
		title: 'Hard Starting',
		description: 'Starting issues are typically spark, fuel, or battery related.',
		actions: [
			{ part: 'Spark Plug', action: 'Check for spark. Clean carbon deposits. Replace if electrode worn. Gap: 0.7–0.8mm.', icon: 'flash' },
			{ part: 'Battery (12V 5Ah)', action: 'Test voltage — should be 12.4V+. Check terminal connections for corrosion.', icon: 'battery-charging' },
			{ part: 'Carburetor', action: 'Check choke operation. Clean fuel strainer. Verify fuel flow from petcock.', icon: 'construct' },
			{ part: 'Engine Oil', action: 'Check level — too thick oil (cold weather) can cause hard starting. Use SAE 10W-40.', icon: 'water' },
		],
		urgency: 'medium',
	},
	power_loss: {
		parts: ['air_filter_replace', 'spark_plug', 'carburetor', 'chain_sprockets', 'valve_clearance'],
		title: 'Loss of Power',
		description: 'Power loss usually indicates air/fuel mixture issues or mechanical wear.',
		actions: [
			{ part: 'Air Filter', action: 'A clogged filter starves the engine. Clean or replace immediately.', icon: 'funnel' },
			{ part: 'Spark Plug', action: 'Weak spark = incomplete combustion. Check color — should be light tan/brown.', icon: 'flash' },
			{ part: 'Carburetor Main Jet', action: 'May be partially blocked. Clean thoroughly with carb cleaner. Check float level.', icon: 'construct' },
			{ part: 'Chain & Sprockets', action: 'Worn sprocket teeth or loose chain wastes engine power. Inspect teeth for hooks.', icon: 'link' },
			{ part: 'Valve Clearance', action: 'Tight valves lose compression = power loss. Re-adjust to spec.', icon: 'options' },
		],
		urgency: 'high',
	},
	stalling: {
		parts: ['carburetor', 'spark_plug', 'engine_oil', 'air_filter_clean'],
		title: 'Engine Stalling',
		description: 'Sudden stalling is often carburetor or fuel delivery related.',
		actions: [
			{ part: 'Carburetor Idle Circuit', action: 'Pilot jet may be clogged. Clean with carb cleaner and compressed air.', icon: 'construct' },
			{ part: 'Fuel Petcock', action: 'Check fuel flow. Clean strainer/filter inside tank. Ensure vacuum line is not cracked.', icon: 'water' },
			{ part: 'Spark Plug', action: 'Intermittent spark can cause stalling. Check plug cap connection and HT coil.', icon: 'flash' },
			{ part: 'CDI / Ignition Coil', action: 'If stalling when hot, CDI unit may be failing. Test or swap to diagnose.', icon: 'flash' },
		],
		urgency: 'high',
	},
	knocking: {
		parts: ['engine_oil', 'valve_clearance', 'engine_overhaul', 'spark_plug'],
		title: 'Engine Knocking',
		description: 'Engine knocking is serious — may indicate low oil, loose components, or worn internals.',
		actions: [
			{ part: 'Engine Oil Level', action: 'URGENT: Check oil immediately. Low oil causes metal-on-metal contact. Fill to proper level.', icon: 'water' },
			{ part: 'Valve Clearance', action: 'Loose valves create tapping/knocking. Adjust to spec with engine cold.', icon: 'options' },
			{ part: 'Cam Chain Tensioner', action: 'Rattling at idle = loose cam chain. Adjust or replace tensioner.', icon: 'link' },
			{ part: 'Piston & Rings', action: 'If knocking persists after above, piston slap is possible. May need engine overhaul.', icon: 'warning' },
		],
		urgency: 'critical',
	},

	// Braking
	spongy: {
		parts: ['brake_fluid_flush', 'brake_check'],
		title: 'Spongy Brakes',
		description: 'Spongy feel typically means air in brake lines or worn brake shoes.',
		actions: [
			{ part: 'Brake Fluid', action: 'Bleed the front brake system. Refill with DOT 4 brake fluid. Check for leaks.', icon: 'water' },
			{ part: 'Brake Pads/Shoes', action: 'Check pad thickness — minimum 1mm. Replace if grooves are gone.', icon: 'construct' },
			{ part: 'Brake Master Cylinder', action: 'Check for internal seal wear. Rebuild kit may be available for your model.', icon: 'build' },
		],
		urgency: 'high',
	},
	squealing: {
		parts: ['brake_check', 'brake_fluid_flush'],
		title: 'Brake Squealing / Grinding',
		description: 'Indicates worn brake pads/shoes. Grinding = metal on metal.',
		actions: [
			{ part: 'Front Brake Pads', action: 'Replace if worn below 1mm. Use semi-metallic pads compatible with your disc brake.', icon: 'construct' },
			{ part: 'Rear Brake Shoes', action: 'Inspect drum shoes. Replace if lining is thin. Clean drum surface.', icon: 'construct' },
			{ part: 'Brake Disc/Drum', action: 'If grinding, check disc for scoring/warping. Minimum thickness must be met.', icon: 'alert-circle' },
		],
		urgency: 'high',
	},
	pulling: {
		parts: ['brake_check', 'tire_pressure', 'suspension'],
		title: 'Brakes Pulling to One Side',
		description: 'Uneven braking can be dangerous. Usually a caliper, tire, or alignment issue.',
		actions: [
			{ part: 'Brake Caliper', action: 'Check if caliper slides freely. Clean and grease guide pins.', icon: 'construct' },
			{ part: 'Tire Pressure', action: 'Uneven tire pressure causes pulling. Set front to 29 psi, rear to 33 psi (loaded).', icon: 'speedometer' },
			{ part: 'Wheel Alignment', action: 'Check rear axle alignment marks. Both sides should match.', icon: 'resize' },
		],
		urgency: 'medium',
	},
	slow_stop: {
		parts: ['brake_check', 'brake_fluid_flush', 'tire_pressure'],
		title: 'Extended Stopping Distance',
		description: 'SAFETY CONCERN: Your motorcycle is taking too long to stop.',
		actions: [
			{ part: 'Brake Pads & Shoes', action: 'URGENT: Replace worn brake components immediately.', icon: 'alert-circle' },
			{ part: 'Brake Fluid', action: 'Old fluid absorbs moisture and reduces braking. Flush and replace with DOT 4.', icon: 'water' },
			{ part: 'Brake Cables (Rear)', action: 'Check rear brake cable for proper adjustment. Free play should be ~20mm at lever.', icon: 'link' },
			{ part: 'Tire Condition', action: 'Worn tires reduce grip. Check tread depth — replace if below 1.5mm.', icon: 'ellipse' },
		],
		urgency: 'critical',
	},

	// Suspension
	bouncy: {
		parts: ['suspension'],
		title: 'Bouncy / Unstable Ride',
		description: 'Shock absorbers on your motorcycle may be worn out.',
		actions: [
			{ part: 'Rear Shock Absorbers', action: 'Check for oil leaks. If bouncing continues after hitting bump, shocks are worn. Replace pair.', icon: 'resize' },
			{ part: 'Front Fork Oil', action: 'Fork oil breaks down over time. Replace with SAE 10W fork oil every 10,000km.', icon: 'water' },
			{ part: 'Tire Pressure', action: 'Over-inflated tires cause bouncy ride. Check and adjust to spec.', icon: 'speedometer' },
		],
		urgency: 'medium',
	},
	bottoming: {
		parts: ['suspension'],
		title: 'Suspension Bottoming Out',
		description: 'Your motorcycle suspension cannot handle the load or is severely worn.',
		actions: [
			{ part: 'Rear Shocks', action: 'May need heavier-duty shocks for tricycle load. Check spring rate.', icon: 'resize' },
			{ part: 'Front Fork Springs', action: 'Springs may be sagging. Check fork oil level — low oil = less damping.', icon: 'water' },
			{ part: 'Load Check', action: 'Verify you\'re not exceeding the motorcycle weight limit as per your manual.', icon: 'scale' },
		],
		urgency: 'high',
	},
	leaning: {
		parts: ['suspension', 'tire_pressure'],
		title: 'Vehicle Leaning to One Side',
		description: 'Uneven suspension or frame issue detected.',
		actions: [
			{ part: 'Shock Absorber Balance', action: 'One shock may be weaker. Replace both as a pair.', icon: 'resize' },
			{ part: 'Sidecar/Tricycle Frame', action: 'Check tricycle sidecar attachment bolts and frame alignment.', icon: 'construct' },
			{ part: 'Tire Pressure', action: 'Check all tires. Uneven pressure causes leaning.', icon: 'speedometer' },
		],
		urgency: 'medium',
	},
	harsh: {
		parts: ['suspension', 'tire_pressure'],
		title: 'Harsh Ride Quality',
		description: 'Feeling every bump means suspension is not absorbing properly.',
		actions: [
			{ part: 'Front Fork Oil', action: 'Change fork oil. Old/thick oil makes ride harsh. Use SAE 10W.', icon: 'water' },
			{ part: 'Rear Shocks', action: 'Check if shocks are seized. They should compress and rebound smoothly.', icon: 'resize' },
			{ part: 'Tire Pressure', action: 'Over-inflated tires transmit road vibration. Lower to recommended PSI.', icon: 'speedometer' },
		],
		urgency: 'low',
	},

	// Steering
	wobbling: {
		parts: ['tire_pressure', 'suspension', 'chain_sprockets'],
		title: 'Steering Wobble / Shaking',
		description: 'SAFETY CONCERN: Wobbling can be tire, bearing, or steering related.',
		actions: [
			{ part: 'Steering Head Bearings', action: 'Check for play. With front wheel off ground, push forks side-to-side. Replace if loose.', icon: 'navigate' },
			{ part: 'Front Wheel Bearing', action: 'Spin wheel — should be smooth. Grinding = replace bearing (6301-2RS).', icon: 'ellipse' },
			{ part: 'Tire Balance & Condition', action: 'Unbalanced or worn tires cause wobble. Check tread and spoke tension.', icon: 'speedometer' },
			{ part: 'Front Fork Alignment', action: 'Loosen triple clamp bolts, compress forks a few times, retighten.', icon: 'resize' },
		],
		urgency: 'high',
	},
	heavy: {
		parts: ['tire_pressure', 'cables'],
		title: 'Heavy Steering',
		description: 'Hard-to-turn handlebars usually means bearing or tire issues.',
		actions: [
			{ part: 'Steering Head Bearings', action: 'May need greasing or replacement. Check for notchy feeling (brinelling).', icon: 'navigate' },
			{ part: 'Tire Pressure (Front)', action: 'Low front tire pressure makes steering heavy. Inflate to 29 psi.', icon: 'speedometer' },
			{ part: 'Cables Routing', action: 'Check that throttle/clutch cables aren\'t binding against steering.', icon: 'link' },
		],
		urgency: 'low',
	},
	drifting: {
		parts: ['tire_pressure', 'suspension', 'chain_sprockets'],
		title: 'Vehicle Drifting to One Side',
		description: 'Your motorcycle is pulling — check alignment and tires.',
		actions: [
			{ part: 'Rear Wheel Alignment', action: 'Check chain adjuster marks are equal on both sides.', icon: 'resize' },
			{ part: 'Tire Pressure', action: 'Uneven pressure between tires causes drifting. Check all tires.', icon: 'speedometer' },
			{ part: 'Tricycle Frame', action: 'Sidecar may have shifted. Check all mounting bolts and brackets.', icon: 'construct' },
		],
		urgency: 'medium',
	},

	// Transmission
	hard_shift: {
		parts: ['engine_oil', 'clutch_plates', 'cables'],
		title: 'Hard / Grinding Shifts',
		description: 'Gear shifting issues are often oil or clutch related.',
		actions: [
			{ part: 'Engine Oil', action: 'Shared engine/transmission oil wears out. Old oil = hard shifts. Replace with SAE 10W-40 4T.', icon: 'water' },
			{ part: 'Clutch Cable', action: 'Adjust free play to 10–20mm at lever. Lubricate cable with cable lube.', icon: 'link' },
			{ part: 'Shift Linkage', action: 'Check shift lever bolt and linkage for wear or looseness.', icon: 'cog' },
		],
		urgency: 'medium',
	},
	slipping: {
		parts: ['clutch_plates', 'engine_oil', 'cables'],
		title: 'Clutch Slipping',
		description: 'RPM rising but speed not increasing — clutch plates are worn.',
		actions: [
			{ part: 'Clutch Plates', action: 'REPLACE clutch friction plates. Check your manual for the correct number of friction and steel plates.', icon: 'layers' },
			{ part: 'Clutch Springs', action: 'Measure spring free length. Replace if shorter than spec (weak springs = slip).', icon: 'resize' },
			{ part: 'Engine Oil Type', action: 'NEVER use car oil with friction modifiers (EC/Energy Conserving). Use JASO MA rated 4T oil.', icon: 'alert-circle' },
			{ part: 'Clutch Cable', action: 'Too tight cable keeps clutch partially disengaged. Adjust free play.', icon: 'link' },
		],
		urgency: 'critical',
	},
	popping: {
		parts: ['transmission_oil', 'engine_overhaul'],
		title: 'Gears Popping Out',
		description: 'SERIOUS: Gear engagement dogs may be worn. Professional inspection needed.',
		actions: [
			{ part: 'Shift Drum & Forks', action: 'Internal transmission damage. Shift forks may be bent. Needs engine case opening.', icon: 'warning' },
			{ part: 'Gear Dogs', action: 'Worn engagement dogs cause gear pop-out. Requires transmission rebuild.', icon: 'construct' },
			{ part: 'Engine Oil', action: 'While awaiting repair, ensure oil level is full to minimize further damage.', icon: 'water' },
		],
		urgency: 'critical',
	},
	noise_shift: {
		parts: ['engine_oil', 'clutch_plates'],
		title: 'Shifting Noise',
		description: 'Some gear noise is normal, but excessive clunking needs attention.',
		actions: [
			{ part: 'Engine Oil Level & Quality', action: 'Low or old oil causes noisy shifts. Replace with fresh SAE 10W-40 JASO MA.', icon: 'water' },
			{ part: 'Clutch Adjustment', action: 'Improper clutch adjustment causes clunky engagement. Set cable free play to spec.', icon: 'link' },
		],
		urgency: 'low',
	},

	// Electrical
	dim_lights: {
		parts: ['battery_test', 'wiring_harness'],
		title: 'Dim Headlights',
		description: 'Dimming lights indicate charging or wiring issues.',
		actions: [
			{ part: 'Battery Voltage', action: 'Test: should read 12.4V+ at rest, 13.5–14.5V running. Below = weak battery.', icon: 'battery-charging' },
			{ part: 'Stator/Magneto', action: 'If voltage low while running, stator coil may be failing. Test AC output.', icon: 'flash' },
			{ part: 'Ground Wires', action: 'Check main ground connections at frame for corrosion. Clean and retighten.', icon: 'link' },
			{ part: 'Bulb Check', action: 'Ensure correct wattage bulb is installed. Check your manual for the correct spec.', icon: 'bulb' },
		],
		urgency: 'low',
	},
	battery_drain: {
		parts: ['battery_test', 'wiring_harness'],
		title: 'Battery Draining Fast',
		description: 'Parasitic drain or charging system issue on your motorcycle.',
		actions: [
			{ part: 'Charging System', action: 'Test stator output (AC volts at connector). Should be 14V+ at 3000 RPM.', icon: 'flash' },
			{ part: 'Regulator/Rectifier', action: 'Test DC output. If not 13.5–14.5V at battery while running, replace reg/rec.', icon: 'hardware-chip' },
			{ part: 'Battery Condition', action: 'Load test battery. If it doesn\'t hold charge after proper charging, replace (YTX5L-BS).', icon: 'battery-charging' },
			{ part: 'Parasitic Draw', action: 'Check for aftermarket accessories draining battery. Disconnect accessories to test.', icon: 'search' },
		],
		urgency: 'medium',
	},
	starter_issue: {
		parts: ['battery_test', 'spark_plug'],
		title: 'Starter Motor Issues',
		description: 'Electric start problems detected on your motorcycle.',
		actions: [
			{ part: 'Battery', action: 'Weak battery is #1 cause. Fully charge and load test.', icon: 'battery-charging' },
			{ part: 'Starter Motor', action: 'If clicks but doesn\'t crank, starter motor brushes may be worn. Service or replace.', icon: 'cog' },
			{ part: 'Starter Relay', action: 'Test relay with direct 12V. Click = relay OK, no click = replace relay.', icon: 'flash' },
			{ part: 'Wiring Connections', action: 'Check all starter circuit wires for loose/corroded connections.', icon: 'link' },
		],
		urgency: 'medium',
	},
	flickering: {
		parts: ['battery_test', 'wiring_harness'],
		title: 'Lights / Signals Flickering',
		description: 'Loose connections or failing components in electrical system.',
		actions: [
			{ part: 'Wiring Connectors', action: 'Check all bullet connectors for corrosion. Clean with contact cleaner.', icon: 'link' },
			{ part: 'Ground Circuit', action: 'Main ground wire at frame may be loose. Clean contact point, retighten.', icon: 'flash' },
			{ part: 'Flasher Relay', action: 'If signal lights flickering, flasher relay may be failing. Replace (2-pin 12V).', icon: 'swap-horizontal' },
		],
		urgency: 'low',
	},

	// Drivetrain
	chain_noise: {
		parts: ['chain', 'chain_sprockets'],
		title: 'Chain Noise / Clatter',
		description: 'Chain maintenance is critical on tricycles due to extra load.',
		actions: [
			{ part: 'Chain Tension', action: 'Adjust slack to 20–25mm at midpoint. Too loose = clatter, too tight = binding.', icon: 'link' },
			{ part: 'Chain Lubrication', action: 'Clean with kerosene, then apply chain lube. Do this every 300-500km.', icon: 'water' },
			{ part: 'Sprocket Inspection', action: 'Check teeth for hooking/sharpening. If teeth look like waves, replace both sprockets + chain.', icon: 'cog' },
		],
		urgency: 'medium',
	},
	chain_slip: {
		parts: ['chain', 'chain_sprockets'],
		title: 'Chain Slipping Off',
		description: 'DANGEROUS: Chain may break if not addressed immediately.',
		actions: [
			{ part: 'Chain & Sprockets', action: 'URGENT: Replace the entire chain and sprocket set. Do not replace individually.', icon: 'alert-circle' },
			{ part: 'Rear Axle Alignment', action: 'Misaligned rear wheel causes chain to walk off. Check adjuster marks.', icon: 'resize' },
			{ part: 'Chain Guide/Slider', action: 'Check if chain guide is broken or missing. Replace if worn through.', icon: 'link' },
		],
		urgency: 'critical',
	},
	chain_vibration: {
		parts: ['chain', 'chain_sprockets', 'engine_oil'],
		title: 'Drivetrain Vibration',
		description: 'Vibration from the chain area of your motorcycle.',
		actions: [
			{ part: 'Chain Tension', action: 'Improper tension causes vibration. Adjust to 20–25mm slack.', icon: 'link' },
			{ part: 'Sprocket Wear', action: 'Worn sprockets cause uneven chain engagement = vibration.', icon: 'cog' },
			{ part: 'Engine Sprocket Nut', action: 'Check front sprocket retaining bolt/clip. Must be secure.', icon: 'construct' },
		],
		urgency: 'medium',
	},

	// Exhaust
	white_smoke: {
		parts: ['engine_oil', 'engine_overhaul'],
		title: 'Excessive White Smoke',
		description: 'White smoke (not just startup condensation) may indicate head gasket or coolant issues.',
		actions: [
			{ part: 'Head Gasket', action: 'If persistent white smoke, head gasket may be leaking. Check for coolant loss (if liquid-cooled model).', icon: 'warning' },
			{ part: 'Cylinder Head', action: 'Check for warped head. Resurface if flatness is out of spec.', icon: 'construct' },
			{ part: 'Note', action: 'Brief white smoke on cold starts is normal (condensation). Worry only if persistent.', icon: 'information-circle' },
		],
		urgency: 'medium',
	},
	blue_smoke: {
		parts: ['engine_oil', 'engine_overhaul', 'valve_clearance'],
		title: 'Blue / Grey Smoke',
		description: 'Oil is burning in the combustion chamber. Common sign of engine wear.',
		actions: [
			{ part: 'Piston Rings', action: 'Worn rings allow oil past piston. Compression test will confirm. May need ring replacement.', icon: 'warning' },
			{ part: 'Valve Stem Seals', action: 'Hardened seals let oil drip onto valves. Replace seals (cheaper than full overhaul).', icon: 'construct' },
			{ part: 'Oil Level', action: 'Check if oil consumption has increased. Monitor oil level daily.', icon: 'water' },
			{ part: 'Engine Overhaul', action: 'If rings and seals don\'t fix it, cylinder may need boring. Get a mechanic assessment.', icon: 'build' },
		],
		urgency: 'high',
	},
	black_smoke: {
		parts: ['carburetor', 'air_filter_replace', 'spark_plug'],
		title: 'Black Smoke',
		description: 'Running too rich — too much fuel in the air/fuel mixture.',
		actions: [
			{ part: 'Air Filter', action: 'Clogged air filter restricts air = rich mixture. Clean or replace immediately.', icon: 'funnel' },
			{ part: 'Carburetor', action: 'Main jet may be too large or float level too high. Clean carb, check float height.', icon: 'construct' },
			{ part: 'Choke', action: 'Ensure choke is fully opening when warm. Stuck choke = constant rich running.', icon: 'options' },
		],
		urgency: 'medium',
	},
	loud_exhaust: {
		parts: ['engine_overhaul'],
		title: 'Loud Exhaust Noise',
		description: 'Exhaust leak or damaged muffler on your motorcycle.',
		actions: [
			{ part: 'Exhaust Gasket', action: 'Check cylinder-to-header gasket. Replace if exhaust leaks at connection.', icon: 'link' },
			{ part: 'Muffler', action: 'Check for holes, rust-through, or loose mounting. Replace or weld if damaged.', icon: 'construct' },
			{ part: 'Header Pipe', action: 'Check header bolts/studs at engine. Retighten or replace exhaust studs.', icon: 'construct' },
		],
		urgency: 'low',
	},
};

// Overall ride rating descriptions
const RIDE_RATINGS = [
	{ value: 5, label: 'Excellent', emoji: '😄', color: '#4ade80', description: 'Everything feels great!' },
	{ value: 4, label: 'Good', emoji: '🙂', color: '#a3e635', description: 'Minor issues noticed' },
	{ value: 3, label: 'Fair', emoji: '😐', color: '#fbbf24', description: 'Some things need attention' },
	{ value: 2, label: 'Poor', emoji: '😟', color: '#f87171', description: 'Multiple issues affecting the ride' },
	{ value: 1, label: 'Bad', emoji: '😖', color: '#dc2626', description: 'Serious problems, unsafe to drive' },
];

// Mileage-based maintenance intervals for client-side display
const MILEAGE_MAINTENANCE_SCHEDULE = [
	{ km: 500, label: 'Break-in', items: ['Oil Change', 'Chain Lube', 'Bolt Check'] },
	{ km: 1000, label: '1st Service', items: ['Oil Change', 'Spark Plug', 'Brake Check'] },
	{ km: 3000, label: 'Regular', items: ['Oil Change', 'Air Filter Clean', 'Chain Adjust'] },
	{ km: 5000, label: 'Intermediate', items: ['Oil + Air Filter Replace', 'Valve Check', 'Brake Inspect'] },
	{ km: 10000, label: 'Major', items: ['Fork Oil', 'Brake Fluid', 'Chain Set Replace', 'Carb Clean'] },
	{ km: 15000, label: 'Extended', items: ['Clutch Check', 'Bearings', 'All Cables Replace'] },
	{ km: 20000, label: 'Overhaul', items: ['Engine Top-End', 'Clutch Replace', 'Full Electrical'] },
];

// Driving condition options
const DRIVING_CONDITIONS = [
	{ id: 'city', label: 'City / Urban', icon: 'business-outline', description: 'Stop-and-go traffic, short trips' },
	{ id: 'highway', label: 'Highway / Long Rides', icon: 'speedometer-outline', description: 'Long distance, steady speed' },
	{ id: 'rough_roads', label: 'Rough / Unpaved Roads', icon: 'warning-outline', description: 'Bumpy, dusty, or muddy roads' },
	{ id: 'mixed', label: 'Mixed Conditions', icon: 'shuffle-outline', description: 'Combination of all road types' },
];

const getUrgencyColor = (urgency) => {
	switch (urgency) {
		case 'critical': return '#dc2626';
		case 'high': return '#f87171';
		case 'medium': return '#fbbf24';
		case 'low': return '#4ade80';
		default: return '#94a3b8';
	}
};

const getUrgencyLabel = (urgency) => {
	switch (urgency) {
		case 'critical': return 'CRITICAL — Fix Immediately';
		case 'high': return 'HIGH — Fix Soon';
		case 'medium': return 'MEDIUM — Schedule Service';
		case 'low': return 'LOW — Monitor';
		default: return 'INFO';
	}
};

// ==================== MAIN COMPONENT ====================

const RideExperienceSurvey = ({ tricycleId, onDiagnosticsComplete }) => {
	const db = useAsyncSQLiteContext();
	const [surveyActive, setSurveyActive] = useState(false);
	const [currentStep, setCurrentStep] = useState(0); // 0 = overall rating, 1 = odometer, 2-9 = categories
	const [overallRating, setOverallRating] = useState(null);
	const [answers, setAnswers] = useState({}); // { categoryId: selectedOptionId }
	const [showResults, setShowResults] = useState(false);
	const [diagnosticResults, setDiagnosticResults] = useState([]);
	const [submitting, setSubmitting] = useState(false);
	const [surveyHistory, setSurveyHistory] = useState([]);
	const [lastSurveyDate, setLastSurveyDate] = useState(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const fadeAnim = useState(new Animated.Value(0))[0];

	// Adaptive learning state
	const [odometerReading, setOdometerReading] = useState('');
	const [drivingCondition, setDrivingCondition] = useState('mixed');
	const [dailyUsageHours, setDailyUsageHours] = useState('');
	const [adaptiveInsights, setAdaptiveInsights] = useState(null);
	const [insightsLoading, setInsightsLoading] = useState(false);
	const [healthScore, setHealthScore] = useState(null);
	const [habitScore, setHabitScore] = useState(null);

	// Language state
	const [language, setLanguage] = useState('en');

	// Translation helpers
	const t = (key) => SURVEY_TRANSLATIONS[language]?.[key] || SURVEY_TRANSLATIONS.en[key] || key;
	const tRating = (value, field) => language === 'tl' ? RATING_TL[value]?.[field] : null;
	const tCatField = (catId, field) => language === 'tl' ? CATEGORY_TL[catId]?.[field] : null;
	const tOpt = (catId, optId) => language === 'tl' ? CATEGORY_TL[catId]?.options?.[optId] : null;
	const tCond = (condId, field) => language === 'tl' ? DRIVING_CONDITION_TL[condId]?.[field] : null;
	const tDiag = (symptomId) => language === 'tl' ? DIAGNOSTIC_TL[symptomId] : null;
	const getTranslatedUrgencyLabel = (urgency) => {
		switch (urgency) {
			case 'critical': return t('urgencyCritical');
			case 'high': return t('urgencyHigh');
			case 'medium': return t('urgencyMedium');
			case 'low': return t('urgencyLow');
			default: return t('urgencyInfo');
		}
	};

	// Load survey history
	useEffect(() => {
		loadSurveyData();
	}, [tricycleId]);

	// Check if we should prompt the user
	useEffect(() => {
		checkSurveyPrompt();
	}, [lastSurveyDate]);

	const loadSurveyData = async () => {
		try {
			const histKey = tricycleId ? `${SURVEY_HISTORY_KEY}_${tricycleId}` : SURVEY_HISTORY_KEY;
			const dateKey = tricycleId ? `${LAST_SURVEY_KEY}_${tricycleId}` : LAST_SURVEY_KEY;

			const histStr = await AsyncStorage.getItem(histKey);
			if (histStr) setSurveyHistory(JSON.parse(histStr));

			const dateStr = await AsyncStorage.getItem(dateKey);
			if (dateStr) setLastSurveyDate(new Date(dateStr));

			// Load adaptive insights from server
			if (tricycleId) {
				loadAdaptiveInsights();
			}
		} catch (e) {
			console.warn('Error loading survey data:', e);
		}
	};

	const loadAdaptiveInsights = async () => {
		if (!tricycleId) return;
		setInsightsLoading(true);
		try {
			const token = await getToken(db);
			const resp = await fetch(`${BACKEND}/api/maintenance/tricycle/${tricycleId}/ride-diagnostic/insights`, {
				headers: { 'Authorization': `Bearer ${token}` },
			});
			const json = await resp.json();
			if (json.success && json.data) {
				setAdaptiveInsights(json.data);
				setHealthScore(json.data.healthScore);
				setHabitScore(json.data.habitScore);
				// Pre-fill odometer from last known reading
				if (json.data.latestOdometer > 0) {
					setOdometerReading(String(json.data.latestOdometer));
				}
			}
		} catch (e) {
			console.warn('Error loading adaptive insights:', e);
		} finally {
			setInsightsLoading(false);
		}
	};

	const checkSurveyPrompt = () => {
		if (!lastSurveyDate) {
			// Never taken a survey — show prompt
			setShowPrompt(true);
			return;
		}
		const daysSince = Math.floor((Date.now() - new Date(lastSurveyDate)) / (1000 * 60 * 60 * 24));
		if (daysSince >= 7) {
			// Weekly prompt
			setShowPrompt(true);
		}
	};

	const startSurvey = () => {
		setAnswers({});
		setOverallRating(null);
		setCurrentStep(0);
		setShowResults(false);
		setDiagnosticResults([]);
		setDrivingCondition('mixed');
		setDailyUsageHours('');
		// Keep odometer pre-filled from last reading
		setSurveyActive(true);
		Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
	};

	const handleRatingSelect = (rating) => {
		setOverallRating(rating);
	};

	const handleOptionSelect = (categoryId, optionId) => {
		setAnswers(prev => ({ ...prev, [categoryId]: optionId }));
	};

	const nextStep = () => {
		if (currentStep === 0 && !overallRating) {
			Alert.alert(t('selectRating'), t('pleaseRateOverall'));
			return;
		}
		// Step 1 is odometer — optional, can skip
		if (currentStep >= 2) {
			const cat = RIDE_SURVEY_CATEGORIES[currentStep - 2];
			if (!answers[cat.id]) {
				Alert.alert(t('selectOption'), `${t('pleaseAnswer')} ${tCatField(cat.id, 'title') || cat.title}.`);
				return;
			}
		}
		const totalCategorySteps = RIDE_SURVEY_CATEGORIES.length + 2; // rating + odometer + categories
		if (currentStep < totalCategorySteps - 1) {
			setCurrentStep(prev => prev + 1);
		} else {
			generateDiagnostics();
		}
	};

	const prevStep = () => {
		if (currentStep > 0) {
			setCurrentStep(prev => prev - 1);
		}
	};

	const generateDiagnostics = async () => {
		setSubmitting(true);

		// Collect all symptoms that aren't "good"
		const issues = [];
		Object.entries(answers).forEach(([categoryId, optionId]) => {
			const category = RIDE_SURVEY_CATEGORIES.find(c => c.id === categoryId);
			const option = category?.options.find(o => o.id === optionId);
			if (option && option.severity > 0) {
				const diagnostic = MOTORCYCLE_DIAGNOSTICS[optionId];
				if (diagnostic) {
					// Check if this is a recurring symptom (adaptive learning)
					let adaptiveBoost = null;
					let recurrenceInfo = null;
					if (adaptiveInsights?.recurringSymptoms) {
						const recurring = adaptiveInsights.recurringSymptoms.find(r => r.symptomId === optionId);
						if (recurring) {
							adaptiveBoost = recurring.urgencyBoost;
							recurrenceInfo = {
								occurrences: recurring.occurrences,
								trend: recurring.trend,
								avgSeverity: recurring.avgSeverity,
								firstSeen: recurring.firstSeen,
							};
						}
					}

					// Check category trend (adaptive learning)
					let categoryTrend = null;
					if (adaptiveInsights?.categoryTrends?.[categoryId]) {
						categoryTrend = adaptiveInsights.categoryTrends[categoryId];
					}

					// Determine effective urgency with boost from recurring data
					let effectiveUrgency = diagnostic.urgency;
					if (adaptiveBoost) {
						const urgencyScale = ['low', 'medium', 'high', 'critical'];
						const currentIdx = urgencyScale.indexOf(diagnostic.urgency);
						const boostedIdx = Math.min(urgencyScale.length - 1, currentIdx + adaptiveBoost);
						effectiveUrgency = urgencyScale[boostedIdx];
					}

					issues.push({
						category: category.title,
						categoryId: category.id,
						symptom: option.label,
						symptomId: optionId,
						severity: option.severity,
						...diagnostic,
						urgency: effectiveUrgency,
						originalUrgency: diagnostic.urgency,
						recurrenceInfo,
						categoryTrend,
					});
				}
			}
		});

		// Sort by severity (highest first), then by recurrence
		issues.sort((a, b) => {
			// Recurring issues with worsening trend first
			const aRecur = a.recurrenceInfo?.occurrences || 0;
			const bRecur = b.recurrenceInfo?.occurrences || 0;
			if (b.severity !== a.severity) return b.severity - a.severity;
			return bRecur - aRecur;
		});

		// Add mileage-based recommendations from adaptive insights
		const mileageIssues = [];
		if (adaptiveInsights?.mileageRecommendations?.length > 0) {
			adaptiveInsights.mileageRecommendations.forEach(rec => {
				mileageIssues.push({
					category: 'Mileage-Based Service',
					categoryId: 'mileage',
					symptom: `${rec.label} ${rec.urgency === 'due_now' ? '(DUE NOW)' : `(in ${rec.kmRemaining} km)`}`,
					symptomId: `mileage_${rec.nextAt}`,
					severity: rec.urgency === 'due_now' ? 3 : 1,
					title: `${rec.label} at ${rec.nextAt.toLocaleString()} km`,
					description: rec.urgency === 'due_now'
						? `Your odometer has reached the ${rec.label} interval. Service recommended now.`
						: `Upcoming service in ${rec.kmRemaining} km. Plan ahead.`,
					actions: rec.items.map(item => ({
						part: item,
						action: rec.urgency === 'due_now' ? 'Service needed now' : 'Schedule soon',
						icon: 'construct',
					})),
					urgency: rec.urgency === 'due_now' ? 'medium' : 'low',
					parts: [],
					isMileageBased: true,
				});
			});
		}

		setDiagnosticResults([...issues, ...mileageIssues]);
		setShowResults(true);

		// Save survey
		const odometerNum = odometerReading ? parseInt(odometerReading) : null;
		const usageNum = dailyUsageHours ? parseFloat(dailyUsageHours) : null;

		const surveyRecord = {
			date: new Date().toISOString(),
			overallRating,
			answers: { ...answers },
			issueCount: issues.length,
			criticalCount: issues.filter(i => i.urgency === 'critical').length,
			highCount: issues.filter(i => i.urgency === 'high').length,
			odometerReading: odometerNum,
			drivingConditions: drivingCondition,
		};

		try {
			const histKey = tricycleId ? `${SURVEY_HISTORY_KEY}_${tricycleId}` : SURVEY_HISTORY_KEY;
			const dateKey = tricycleId ? `${LAST_SURVEY_KEY}_${tricycleId}` : LAST_SURVEY_KEY;

			const updatedHistory = [surveyRecord, ...surveyHistory].slice(0, 50);
			await AsyncStorage.setItem(histKey, JSON.stringify(updatedHistory));
			await AsyncStorage.setItem(dateKey, new Date().toISOString());

			setSurveyHistory(updatedHistory);
			setLastSurveyDate(new Date());
			setShowPrompt(false);

			// Sync to server
			if (tricycleId) {
				try {
					const token = await getToken(db);
					await fetch(`${BACKEND}/api/maintenance/tricycle/${tricycleId}/ride-diagnostic`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${token}`,
						},
						body: JSON.stringify({
							overallRating,
							answers,
							diagnostics: issues.map(i => ({
								categoryId: i.categoryId,
								symptomId: i.symptomId,
								symptom: i.symptom,
								severity: i.severity,
								urgency: i.urgency,
								partsToCheck: i.parts,
							})),
							odometerReading: odometerNum,
							drivingConditions: drivingCondition,
							dailyUsageHours: usageNum,
						}),
					});
					// Refresh adaptive insights after submission
					loadAdaptiveInsights();
				} catch (serverErr) {
					console.warn('Failed to sync ride diagnostic to server:', serverErr);
				}
			}

			// Notify parent component
			if (onDiagnosticsComplete) {
				onDiagnosticsComplete(issues);
			}
		} catch (e) {
			console.warn('Error saving survey:', e);
		} finally {
			setSubmitting(false);
		}
	};

	const closeSurvey = () => {
		Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
			setSurveyActive(false);
			setShowResults(false);
			setCurrentStep(0);
		});
	};

	// ==================== RENDER: PROMPT CARD ====================
	const renderPromptCard = () => {
		if (!showPrompt && surveyHistory.length > 0) return null;

		const daysSinceStr = lastSurveyDate
			? `${Math.floor((Date.now() - new Date(lastSurveyDate)) / (1000 * 60 * 60 * 24))} ${t('daysAgo')}`
			: t('never');

		return (
			<TouchableOpacity
				style={{
					backgroundColor: colors.ivory1,
					borderRadius: 16,
					padding: 16,
					marginBottom: 16,
					borderWidth: 1,
					borderColor: colors.primary + '30',
					borderLeftWidth: 4,
					borderLeftColor: colors.primary,
				}}
				onPress={startSurvey}
				activeOpacity={0.7}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
					<View style={{
						width: 40, height: 40, borderRadius: 20,
						backgroundColor: colors.primary + '15',
						alignItems: 'center', justifyContent: 'center', marginRight: 12,
					}}>
						<Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 15, fontWeight: '700', color: colors.orangeShade7 }}>
							{t('howsYourRide')}
						</Text>
						<Text style={{ fontSize: 12, color: colors.orangeShade5, marginTop: 2 }}>
							{t('diagnosticCheck')}
						</Text>
					</View>
					<Ionicons name="chevron-forward" size={20} color={colors.primary} />
				</View>
				<Text style={{ fontSize: 13, color: colors.orangeShade5, lineHeight: 18 }}>
					{t('tellUsAbout')}
				</Text>
				{/* Health Score Badge (from adaptive learning) */}
				{healthScore != null && (
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						marginTop: 10,
						backgroundColor: healthScore >= 70 ? '#4ade8012' : healthScore >= 40 ? '#fbbf2412' : '#dc262612',
						paddingHorizontal: 10,
						paddingVertical: 6,
						borderRadius: 8,
						alignSelf: 'flex-start',
					}}>
						<Ionicons
							name="heart"
							size={14}
							color={healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626'}
						/>
						<Text style={{
							fontSize: 12,
							fontWeight: '700',
							color: healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626',
							marginLeft: 5,
						}}>
							Health: {healthScore}%
						</Text>
						{adaptiveInsights?.totalSurveys > 0 && (
							<Text style={{ fontSize: 10, color: colors.orangeShade4, marginLeft: 8 }}>
								{t('basedOn')} {adaptiveInsights.totalSurveys} {adaptiveInsights.totalSurveys !== 1 ? t('checkups') : t('checkup')}
							</Text>
						)}
					</View>
				)}
				<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
					<Text style={{ fontSize: 11, color: colors.orangeShade4 }}>
						{t('lastCheck')}: {daysSinceStr}
					</Text>
					<Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
						{t('startCheck')}
					</Text>
				</View>
			</TouchableOpacity>
		);
	};

	// ==================== RENDER: LAST SURVEY SUMMARY ====================
	const renderLastSurveySummary = () => {
		if (surveyHistory.length === 0 || showPrompt) return null;
		const last = surveyHistory[0];
		const rating = RIDE_RATINGS.find(r => r.value === last.overallRating) || RIDE_RATINGS[2];

		return (
			<View style={{
				backgroundColor: colors.ivory1,
				borderRadius: 16,
				padding: 16,
				marginBottom: 16,
				borderWidth: 1,
				borderColor: colors.ivory3,
			}}>
				<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
					<Text style={{ fontSize: 14, fontWeight: '700', color: colors.orangeShade7 }}>
						{t('lastRideCheck')}
					</Text>
					<Text style={{ fontSize: 11, color: colors.orangeShade4 }}>
						{new Date(last.date).toLocaleDateString()}
					</Text>
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
					<Text style={{ fontSize: 28, marginRight: 10 }}>{rating.emoji}</Text>
					<View>
						<Text style={{ fontSize: 16, fontWeight: '700', color: rating.color }}>{tRating(last.overallRating, 'label') || rating.label}</Text>
						<Text style={{ fontSize: 12, color: colors.orangeShade5 }}>
							{last.issueCount === 0 ? t('noIssuesDetected') : `${last.issueCount} ${t('issuesFound')}`}
						</Text>
					</View>
				</View>
				{(last.criticalCount > 0 || last.highCount > 0) && (
					<View style={{ flexDirection: 'row', gap: 8 }}>
						{last.criticalCount > 0 && (
							<View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#dc262615', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
								<Ionicons name="alert-circle" size={14} color="#dc2626" />
								<Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600', marginLeft: 4 }}>
									{last.criticalCount} {t('critical')}
								</Text>
							</View>
						)}
						{last.highCount > 0 && (
							<View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8717115', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
								<Ionicons name="warning" size={14} color="#f87171" />
								<Text style={{ fontSize: 11, color: '#f87171', fontWeight: '600', marginLeft: 4 }}>
									{last.highCount} High
								</Text>
							</View>
						)}
					</View>
				)}
				{/* Adaptive Insights Summary */}
				{adaptiveInsights && (
					<View style={{
						flexDirection: 'row',
						gap: 8,
						marginTop: last.criticalCount > 0 || last.highCount > 0 ? 8 : 0,
						flexWrap: 'wrap',
					}}>
						{healthScore != null && (
							<View style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: healthScore >= 70 ? '#4ade8012' : healthScore >= 40 ? '#fbbf2412' : '#dc262612',
								paddingHorizontal: 8,
								paddingVertical: 4,
								borderRadius: 8,
							}}>
								<Ionicons name="heart" size={12} color={healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626'} />
								<Text style={{ fontSize: 11, fontWeight: '600', marginLeft: 4, color: healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626' }}>
									{t('health')} {healthScore}%
								</Text>
							</View>
						)}
						{habitScore != null && (
							<View style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: colors.primary + '12',
								paddingHorizontal: 8,
								paddingVertical: 4,
								borderRadius: 8,
							}}>
								<Ionicons name="ribbon" size={12} color={colors.primary} />
								<Text style={{ fontSize: 11, fontWeight: '600', marginLeft: 4, color: colors.primary }}>
									{t('habit')} {habitScore}%
								</Text>
							</View>
						)}
						{adaptiveInsights.latestOdometer > 0 && (
							<View style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: colors.orangeShade2 + '30',
								paddingHorizontal: 8,
								paddingVertical: 4,
								borderRadius: 8,
							}}>
								<Ionicons name="speedometer" size={12} color={colors.orangeShade6} />
								<Text style={{ fontSize: 11, fontWeight: '600', marginLeft: 4, color: colors.orangeShade6 }}>
									{adaptiveInsights.latestOdometer.toLocaleString()} km
								</Text>
							</View>
						)}
						{adaptiveInsights.recurringSymptoms?.length > 0 && (
							<View style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: '#f8717115',
								paddingHorizontal: 8,
								paddingVertical: 4,
								borderRadius: 8,
							}}>
								<Ionicons name="repeat" size={12} color="#f87171" />
								<Text style={{ fontSize: 11, fontWeight: '600', marginLeft: 4, color: '#f87171' }}>
									{adaptiveInsights.recurringSymptoms.length} {t('recurring')}
								</Text>
							</View>
						)}
					</View>
				)}
				<TouchableOpacity
					onPress={startSurvey}
					style={{
						marginTop: 12,
						borderTopWidth: 1,
						borderTopColor: colors.ivory3,
						paddingTop: 10,
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Ionicons name="refresh" size={16} color={colors.primary} />
					<Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginLeft: 6 }}>
						{t('takeNewCheck')}
					</Text>
				</TouchableOpacity>
			</View>
		);
	};

	// ==================== RENDER: SURVEY MODAL ====================
	const renderSurveyModal = () => {
		const totalSteps = RIDE_SURVEY_CATEGORIES.length + 2; // +1 rating, +1 odometer
		const progress = ((currentStep + 1) / totalSteps) * 100;

		return (
			<Modal
				visible={surveyActive}
				transparent={false}
				animationType="slide"
				onRequestClose={closeSurvey}
			>
				<View style={{ flex: 1, backgroundColor: colors.ivory1 }}>
					{/* Header */}
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
						paddingHorizontal: 16,
						paddingVertical: 14,
						borderBottomWidth: 1,
						borderBottomColor: colors.ivory3,
					}}>
						<TouchableOpacity
							onPress={closeSurvey}
							style={{
								width: 36, height: 36,
								alignItems: 'center', justifyContent: 'center',
								borderRadius: 18, backgroundColor: colors.ivory2,
							}}
						>
							<Ionicons name="close" size={22} color={colors.orangeShade7} />
						</TouchableOpacity>
						<View style={{ alignItems: 'center' }}>
							<Text style={{ fontSize: 16, fontWeight: '700', color: colors.orangeShade7 }}>
								{t('rideExperienceCheck')}
							</Text>
							<Text style={{ fontSize: 11, color: colors.orangeShade5 }}>
								{t('motorcycleDiagnostics')}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => setLanguage(language === 'en' ? 'tl' : 'en')}
							style={{
								width: 36, height: 36,
								alignItems: 'center', justifyContent: 'center',
								borderRadius: 18, backgroundColor: colors.primary + '15',
								borderWidth: 1.5, borderColor: colors.primary + '30',
							}}
						>
							<Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
								{language === 'en' ? 'TL' : 'EN'}
							</Text>
						</TouchableOpacity>
					</View>

					{/* Progress Bar */}
					{!showResults && (
						<View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
							<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
								<Text style={{ fontSize: 11, color: colors.orangeShade5 }}>
									{t('step')} {currentStep + 1} {t('of')} {totalSteps}
								</Text>
								<Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
									{Math.round(progress)}%
								</Text>
							</View>
							<View style={{
								height: 6, backgroundColor: colors.ivory3, borderRadius: 3,
							}}>
								<View style={{
									height: 6, backgroundColor: colors.primary, borderRadius: 3,
									width: `${progress}%`,
								}} />
							</View>
						</View>
					)}

					{/* Content */}
					{showResults ? renderResults() : (
						<ScrollView 
							style={{ flex: 1 }} 
							contentContainerStyle={{ padding: 16 }}
							showsVerticalScrollIndicator={false}
						>
							{currentStep === 0 ? renderOverallRating() 
								: currentStep === 1 ? renderOdometerStep()
								: renderCategoryQuestion()}
						</ScrollView>
					)}

					{/* Footer Navigation */}
					{!showResults && (
						<View style={{
							flexDirection: 'row',
							padding: 16,
							borderTopWidth: 1,
							borderTopColor: colors.ivory3,
							gap: 10,
						}}>
							{currentStep > 0 && (
								<TouchableOpacity
									onPress={prevStep}
									style={{
										flex: 1,
										flexDirection: 'row',
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: colors.ivory2,
										paddingVertical: 14,
										borderRadius: 12,
										borderWidth: 1,
										borderColor: colors.ivory3,
									}}
								>
									<Ionicons name="arrow-back" size={18} color={colors.orangeShade7} />
									<Text style={{ fontSize: 15, fontWeight: '600', color: colors.orangeShade7, marginLeft: 6 }}>
										{t('back')}
									</Text>
								</TouchableOpacity>
							)}
							<TouchableOpacity
								onPress={nextStep}
								disabled={submitting}
								style={{
									flex: 1,
									flexDirection: 'row',
									alignItems: 'center',
									justifyContent: 'center',
									backgroundColor: colors.primary,
									paddingVertical: 14,
									borderRadius: 12,
									opacity: submitting ? 0.7 : 1,
								}}
							>
								{submitting ? (
									<ActivityIndicator size="small" color="#fff" />
								) : (
									<>
										<Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginRight: 6 }}>
											{currentStep === RIDE_SURVEY_CATEGORIES.length + 1 ? t('getDiagnosis') : t('next')}
										</Text>
										<Ionicons
											name={currentStep === RIDE_SURVEY_CATEGORIES.length + 1 ? 'medical' : 'arrow-forward'}
											size={18}
											color="#fff"
										/>
									</>
								)}
							</TouchableOpacity>
						</View>
					)}
				</View>
			</Modal>
		);
	};

	// ==================== RENDER: OVERALL RATING STEP ====================
	const renderOverallRating = () => (
		<View>
			<View style={{ alignItems: 'center', marginBottom: 24 }}>
				<View style={{
					width: 64, height: 64, borderRadius: 32,
					backgroundColor: colors.primary + '15',
					alignItems: 'center', justifyContent: 'center',
					marginBottom: 12,
				}}>
					<Ionicons name="bicycle-outline" size={32} color={colors.primary} />
				</View>
				<Text style={{ fontSize: 20, fontWeight: '800', color: colors.orangeShade7, textAlign: 'center' }}>
					{t('howsYourDrive')}
				</Text>
				<Text style={{ fontSize: 14, color: colors.orangeShade5, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
					{t('rateOverall')}
				</Text>
			</View>

			{RIDE_RATINGS.map(rating => {
				const isSelected = overallRating === rating.value;
				return (
					<TouchableOpacity
						key={rating.value}
						onPress={() => handleRatingSelect(rating.value)}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							padding: 16,
							marginBottom: 10,
							borderRadius: 14,
							backgroundColor: isSelected ? rating.color + '15' : colors.ivory4,
							borderWidth: 2,
							borderColor: isSelected ? rating.color : 'transparent',
						}}
					>
						<Text style={{ fontSize: 28, marginRight: 14 }}>{rating.emoji}</Text>
						<View style={{ flex: 1 }}>
							<Text style={{
								fontSize: 16, fontWeight: '700',
								color: isSelected ? rating.color : colors.orangeShade7,
							}}>
								{tRating(rating.value, 'label') || rating.label}
							</Text>
							<Text style={{ fontSize: 12, color: colors.orangeShade5, marginTop: 2 }}>
								{tRating(rating.value, 'description') || rating.description}
							</Text>
						</View>
						{isSelected && (
							<Ionicons name="checkmark-circle" size={24} color={rating.color} />
						)}
					</TouchableOpacity>
				);
			})}
		</View>
	);

	// ==================== RENDER: ODOMETER & DRIVING CONDITIONS STEP ====================
	const renderOdometerStep = () => {
		const lastOdo = adaptiveInsights?.latestOdometer || 0;

		return (
			<View>
				<View style={{ alignItems: 'center', marginBottom: 20 }}>
					<View style={{
						width: 64, height: 64, borderRadius: 32,
						backgroundColor: colors.primary + '15',
						alignItems: 'center', justifyContent: 'center',
						marginBottom: 12,
					}}>
						<Ionicons name="speedometer-outline" size={32} color={colors.primary} />
					</View>
					<Text style={{ fontSize: 20, fontWeight: '800', color: colors.orangeShade7, textAlign: 'center' }}>
						{t('motorcycleDetails')}
					</Text>
					<Text style={{ fontSize: 14, color: colors.orangeShade5, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
						{t('helpUsLearn')}
					</Text>
				</View>

				{/* Odometer Input */}
				<View style={{
					backgroundColor: colors.ivory4,
					borderRadius: 14,
					padding: 16,
					marginBottom: 14,
				}}>
					<Text style={{ fontSize: 14, fontWeight: '700', color: colors.orangeShade7, marginBottom: 4 }}>
						{t('currentOdometer')}
					</Text>
					<Text style={{ fontSize: 11, color: colors.orangeShade4, marginBottom: 10 }}>
						{lastOdo > 0 ? `${t('lastRecorded')}: ${lastOdo.toLocaleString()} km` : t('enterMileage')}
					</Text>
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						backgroundColor: colors.ivory1,
						borderRadius: 10,
						borderWidth: 1,
						borderColor: colors.ivory3,
						paddingHorizontal: 14,
					}}>
						<Ionicons name="speedometer" size={20} color={colors.primary} />
						<TextInput
							style={{
								flex: 1,
								fontSize: 18,
								fontWeight: '700',
								color: colors.orangeShade7,
								paddingVertical: 12,
								paddingHorizontal: 10,
							}}
							value={odometerReading}
							onChangeText={(text) => setOdometerReading(text.replace(/[^0-9]/g, ''))}
							placeholder={lastOdo > 0 ? String(lastOdo) : '0'}
							placeholderTextColor={colors.orangeShade3}
							keyboardType="numeric"
							maxLength={7}
						/>
						<Text style={{ fontSize: 14, color: colors.orangeShade5, fontWeight: '600' }}>km</Text>
					</View>
					{odometerReading && lastOdo > 0 && parseInt(odometerReading) > lastOdo && (
						<Text style={{ fontSize: 11, color: '#16a34a', marginTop: 6 }}>
							+{(parseInt(odometerReading) - lastOdo).toLocaleString()} {t('sinceLastCheckup')}
						</Text>
					)}
				</View>

				{/* Daily Usage Hours */}
				<View style={{
					backgroundColor: colors.ivory4,
					borderRadius: 14,
					padding: 16,
					marginBottom: 14,
				}}>
					<Text style={{ fontSize: 14, fontWeight: '700', color: colors.orangeShade7, marginBottom: 4 }}>
						{t('avgDailyUsage')}
					</Text>
					<Text style={{ fontSize: 11, color: colors.orangeShade4, marginBottom: 10 }}>
						{t('howManyHours')}
					</Text>
					<View style={{
						flexDirection: 'row',
						alignItems: 'center',
						backgroundColor: colors.ivory1,
						borderRadius: 10,
						borderWidth: 1,
						borderColor: colors.ivory3,
						paddingHorizontal: 14,
					}}>
						<Ionicons name="time-outline" size={20} color={colors.primary} />
						<TextInput
							style={{
								flex: 1,
								fontSize: 18,
								fontWeight: '700',
								color: colors.orangeShade7,
								paddingVertical: 12,
								paddingHorizontal: 10,
							}}
							value={dailyUsageHours}
							onChangeText={(text) => setDailyUsageHours(text.replace(/[^0-9.]/g, ''))}
							placeholder="e.g. 6"
							placeholderTextColor={colors.orangeShade3}
							keyboardType="decimal-pad"
							maxLength={4}
						/>
						<Text style={{ fontSize: 14, color: colors.orangeShade5, fontWeight: '600' }}>hrs/day</Text>
					</View>
				</View>

				{/* Driving Conditions */}
				<View style={{ marginBottom: 10 }}>
					<Text style={{ fontSize: 14, fontWeight: '700', color: colors.orangeShade7, marginBottom: 4 }}>
						{t('primaryConditions')}
					</Text>
					<Text style={{ fontSize: 11, color: colors.orangeShade4, marginBottom: 10 }}>
						{t('affectsInterval')}
					</Text>
					{DRIVING_CONDITIONS.map(condition => {
						const isSelected = drivingCondition === condition.id;
						return (
							<TouchableOpacity
								key={condition.id}
								onPress={() => setDrivingCondition(condition.id)}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									padding: 14,
									marginBottom: 8,
									borderRadius: 12,
									backgroundColor: isSelected ? colors.primary + '12' : colors.ivory4,
									borderWidth: 2,
									borderColor: isSelected ? colors.primary : 'transparent',
								}}
							>
								<View style={{
									width: 36, height: 36, borderRadius: 18,
									backgroundColor: isSelected ? colors.primary + '20' : colors.ivory3,
									alignItems: 'center', justifyContent: 'center', marginRight: 12,
								}}>
									<Ionicons name={condition.icon} size={18} color={isSelected ? colors.primary : colors.orangeShade5} />
								</View>
								<View style={{ flex: 1 }}>
									<Text style={{
										fontSize: 14, fontWeight: '600',
										color: isSelected ? colors.primary : colors.orangeShade6,
									}}>
										{tCond(condition.id, 'label') || condition.label}
									</Text>
									<Text style={{ fontSize: 11, color: colors.orangeShade4, marginTop: 1 }}>
										{tCond(condition.id, 'description') || condition.description}
									</Text>
								</View>
								{isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
							</TouchableOpacity>
						);
					})}
				</View>

				{/* Mileage milestone preview */}
				{odometerReading && parseInt(odometerReading) > 0 && (
					<View style={{
						backgroundColor: colors.primary + '08',
						borderRadius: 12,
						padding: 14,
						marginTop: 4,
					}}>
						<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
							<Ionicons name="calendar-outline" size={16} color={colors.primary} />
							<Text style={{ fontSize: 12, fontWeight: '700', color: colors.orangeShade7, marginLeft: 6 }}>
								Upcoming Service Milestones
							</Text>
						</View>
						{MILEAGE_MAINTENANCE_SCHEDULE
							.map(interval => {
								const nextMilestone = Math.ceil(parseInt(odometerReading) / interval.km) * interval.km;
								const kmUntil = nextMilestone - parseInt(odometerReading);
								return { ...interval, nextMilestone, kmUntil };
							})
							.filter(m => m.kmUntil > 0)
							.slice(0, 3)
							.map((m, i) => (
								<View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
									<View style={{
										width: 6, height: 6, borderRadius: 3,
										backgroundColor: m.kmUntil <= 200 ? '#f87171' : m.kmUntil <= 500 ? '#fbbf24' : '#4ade80',
										marginRight: 8,
									}} />
									<Text style={{ fontSize: 11, color: colors.orangeShade5, flex: 1 }}>
										{m.label} at {m.nextMilestone.toLocaleString()} km
									</Text>
									<Text style={{
										fontSize: 11, fontWeight: '600',
										color: m.kmUntil <= 200 ? '#f87171' : m.kmUntil <= 500 ? '#fbbf24' : '#4ade80',
									}}>
										{m.kmUntil.toLocaleString()} {t('kmAway')}
									</Text>
								</View>
							))}
					</View>
				)}
			</View>
		);
	};

	// ==================== RENDER: CATEGORY QUESTION ====================
	const renderCategoryQuestion = () => {
		const category = RIDE_SURVEY_CATEGORIES[currentStep - 2];
		if (!category) return null;
		const selectedOption = answers[category.id];

		// Get adaptive trend info for this category
		const trend = adaptiveInsights?.categoryTrends?.[category.id];
		const trendIcon = trend?.trend === 'worsening' ? 'trending-up' : trend?.trend === 'improving' ? 'trending-down' : null;
		const trendColor = trend?.trend === 'worsening' ? '#dc2626' : trend?.trend === 'improving' ? '#16a34a' : colors.orangeShade4;
		const trendLabel = trend?.trend === 'worsening' ? t('gettingWorseLabel') : trend?.trend === 'improving' ? t('improvingLabel') : null;

		// Find any recurring symptoms for this category
		const recurringForCategory = adaptiveInsights?.recurringSymptoms?.filter(r => r.categoryId === category.id) || [];

		return (
			<View>
				<View style={{ alignItems: 'center', marginBottom: 20 }}>
					<View style={{
						width: 56, height: 56, borderRadius: 28,
						backgroundColor: colors.primary + '12',
						alignItems: 'center', justifyContent: 'center',
						marginBottom: 10,
					}}>
						<Ionicons name={category.icon} size={28} color={colors.primary} />
					</View>
					<Text style={{ fontSize: 18, fontWeight: '700', color: colors.orangeShade7, textAlign: 'center' }}>
						{tCatField(category.id, 'title') || category.title}
					</Text>
					{/* Adaptive trend badge */}
					{trendLabel && (
						<View style={{
							flexDirection: 'row',
							alignItems: 'center',
							backgroundColor: trendColor + '12',
							paddingHorizontal: 10,
							paddingVertical: 4,
							borderRadius: 8,
							marginTop: 6,
						}}>
							<Ionicons name={trendIcon} size={14} color={trendColor} />
							<Text style={{ fontSize: 11, fontWeight: '600', color: trendColor, marginLeft: 4 }}>
								{trendLabel} ({t('basedOnCheckups')} {trend.dataPoints} {t('checkupsLabel')})
							</Text>
						</View>
					)}
					<Text style={{ fontSize: 14, color: colors.orangeShade5, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
						{tCatField(category.id, 'question') || category.question}
					</Text>
				</View>

				{/* Recurring issue warning for this category */}
				{recurringForCategory.length > 0 && (
					<View style={{
						backgroundColor: '#f8717110',
						borderRadius: 12,
						padding: 12,
						marginBottom: 14,
						borderWidth: 1,
						borderColor: '#f8717125',
					}}>
						<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
							<Ionicons name="repeat" size={14} color="#f87171" />
							<Text style={{ fontSize: 12, fontWeight: '700', color: '#f87171', marginLeft: 6 }}>
								{t('recurringIssueDetected')}
							</Text>
						</View>
						{recurringForCategory.map(r => (
							<Text key={r.symptomId} style={{ fontSize: 11, color: colors.orangeShade5, lineHeight: 16, marginTop: 2 }}>
								• "{r.symptom}" {t('reported')} {r.occurrences} {t('times')}
								{r.trend === 'worsening' ? ` (${t('gettingWorse')} ↑)` : r.trend === 'improving' ? ` (${t('improving')} ↓)` : ''}
							</Text>
						))}
					</View>
				)}

				{category.options.map(option => {
					const isSelected = selectedOption === option.id;
					const severityColor = option.severity === 0 ? '#4ade80'
						: option.severity <= 2 ? '#fbbf24'
						: option.severity <= 3 ? '#f97316'
						: '#dc2626';

					// Check if this specific option is a recurring symptom
					const isRecurring = recurringForCategory.some(r => r.symptomId === option.id);

					return (
						<TouchableOpacity
							key={option.id}
							onPress={() => handleOptionSelect(category.id, option.id)}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 16,
								marginBottom: 10,
								borderRadius: 14,
								backgroundColor: isSelected ? severityColor + '12' : colors.ivory4,
								borderWidth: 2,
								borderColor: isSelected ? severityColor : isRecurring ? '#f8717130' : 'transparent',
							}}
						>
							<Text style={{ fontSize: 20, marginRight: 12 }}>{option.emoji}</Text>
							<View style={{ flex: 1 }}>
								<Text style={{
									fontSize: 15, fontWeight: '600',
									color: isSelected ? severityColor : colors.orangeShade6,
								}}>
									{tOpt(category.id, option.id) || option.label}
								</Text>
								{isRecurring && (
									<Text style={{ fontSize: 10, color: '#f87171', fontWeight: '600', marginTop: 2 }}>
										{t('previouslyReported')}
									</Text>
								)}
							</View>
							{isSelected && (
								<Ionicons name="checkmark-circle" size={22} color={severityColor} />
							)}
						</TouchableOpacity>
					);
				})}
			</View>
		);
	};

	// ==================== RENDER: DIAGNOSTIC RESULTS ====================
	const renderResults = () => {
		const ratingInfo = RIDE_RATINGS.find(r => r.value === overallRating) || RIDE_RATINGS[2];
		const hasIssues = diagnosticResults.length > 0;

		return (
			<ScrollView 
				style={{ flex: 1 }} 
				contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Overall Summary */}
				<View style={{
					alignItems: 'center',
					backgroundColor: ratingInfo.color + '12',
					borderRadius: 16,
					padding: 20,
					marginBottom: 20,
					borderWidth: 1,
					borderColor: ratingInfo.color + '30',
				}}>
					<Text style={{ fontSize: 48 }}>{ratingInfo.emoji}</Text>
					<Text style={{ fontSize: 22, fontWeight: '800', color: ratingInfo.color, marginTop: 8 }}>
						{tRating(ratingInfo.value, 'label') || ratingInfo.label} {t('ride')}
					</Text>
					<Text style={{ fontSize: 14, color: colors.orangeShade5, marginTop: 4, textAlign: 'center' }}>
						{hasIssues
							? `${diagnosticResults.length} ${t('issuesDetected')}`
							: t('runningGreat')
						}
					</Text>
					{/* Odometer display */}
					{odometerReading && parseInt(odometerReading) > 0 && (
						<View style={{
							flexDirection: 'row',
							alignItems: 'center',
							marginTop: 10,
							backgroundColor: 'rgba(0,0,0,0.06)',
							paddingHorizontal: 12,
							paddingVertical: 5,
							borderRadius: 8,
						}}>
							<Ionicons name="speedometer" size={14} color={colors.orangeShade6} />
							<Text style={{ fontSize: 12, fontWeight: '600', color: colors.orangeShade6, marginLeft: 5 }}>
								{parseInt(odometerReading).toLocaleString()} km
							</Text>
						</View>
					)}
				</View>

				{/* Adaptive Health & Habit Score Card */}
				{adaptiveInsights && (
					<View style={{
						flexDirection: 'row',
						gap: 10,
						marginBottom: 16,
					}}>
						{/* Health Score */}
						<View style={{
							flex: 1,
							backgroundColor: colors.ivory1,
							borderRadius: 14,
							padding: 14,
							alignItems: 'center',
							borderWidth: 1,
							borderColor: colors.ivory3,
						}}>
							<View style={{
								width: 48, height: 48, borderRadius: 24,
								backgroundColor: healthScore >= 70 ? '#4ade8018' : healthScore >= 40 ? '#fbbf2418' : '#dc262618',
								alignItems: 'center', justifyContent: 'center',
								marginBottom: 6,
							}}>
								<Text style={{
									fontSize: 16, fontWeight: '800',
									color: healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626',
								}}>
									{healthScore}
								</Text>
							</View>
							<Text style={{ fontSize: 11, fontWeight: '700', color: colors.orangeShade6 }}>
								{t('healthScore')}
							</Text>
							<Text style={{ fontSize: 10, color: colors.orangeShade4, marginTop: 2 }}>
								{healthScore >= 70 ? t('goodShape') : healthScore >= 40 ? t('needsAttention') : t('criticalStatus')}
							</Text>
						</View>

						{/* Habit Score */}
						<View style={{
							flex: 1,
							backgroundColor: colors.ivory1,
							borderRadius: 14,
							padding: 14,
							alignItems: 'center',
							borderWidth: 1,
							borderColor: colors.ivory3,
						}}>
							<View style={{
								width: 48, height: 48, borderRadius: 24,
								backgroundColor: colors.primary + '15',
								alignItems: 'center', justifyContent: 'center',
								marginBottom: 6,
							}}>
								<Text style={{
									fontSize: 16, fontWeight: '800',
									color: colors.primary,
								}}>
									{habitScore}
								</Text>
							</View>
							<Text style={{ fontSize: 11, fontWeight: '700', color: colors.orangeShade6 }}>
								{t('habitScore')}
							</Text>
							<Text style={{ fontSize: 10, color: colors.orangeShade4, marginTop: 2 }}>
								{habitScore >= 70 ? t('consistent') : habitScore >= 40 ? t('keepChecking') : t('checkMoreOften')}
							</Text>
						</View>

						{/* Surveys Count */}
						<View style={{
							flex: 1,
							backgroundColor: colors.ivory1,
							borderRadius: 14,
							padding: 14,
							alignItems: 'center',
							borderWidth: 1,
							borderColor: colors.ivory3,
						}}>
							<View style={{
								width: 48, height: 48, borderRadius: 24,
								backgroundColor: colors.orangeShade2 + '30',
								alignItems: 'center', justifyContent: 'center',
								marginBottom: 6,
							}}>
								<Text style={{
									fontSize: 16, fontWeight: '800',
									color: colors.orangeShade6,
								}}>
									{adaptiveInsights.totalSurveys + 1}
								</Text>
							</View>
							<Text style={{ fontSize: 11, fontWeight: '700', color: colors.orangeShade6 }}>
								{t('totalChecks')}
							</Text>
							<Text style={{ fontSize: 10, color: colors.orangeShade4, marginTop: 2 }}>
								{adaptiveInsights.avgDaysBetween > 0 ? `${t('every')}${adaptiveInsights.avgDaysBetween}d` : t('firstCheck')}
							</Text>
						</View>
					</View>
				)}

				{/* Predicted / Watch-out Issues (from adaptive learning) */}
				{adaptiveInsights?.predictedIssues?.length > 0 && (
					<View style={{
						backgroundColor: '#fef3c710',
						borderRadius: 14,
						padding: 14,
						marginBottom: 16,
						borderWidth: 1,
						borderColor: '#fbbf2425',
					}}>
						<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
							<Ionicons name="bulb-outline" size={18} color="#d97706" />
							<Text style={{ fontSize: 13, fontWeight: '700', color: '#d97706', marginLeft: 6 }}>
								{t('predictedIssues')}
							</Text>
						</View>
						<Text style={{ fontSize: 11, color: colors.orangeShade5, marginBottom: 10, lineHeight: 16 }}>
							{t('basedOnHistory')}
						</Text>
						{adaptiveInsights.predictedIssues.slice(0, 5).map((pred, i) => (
							<View key={i} style={{
								flexDirection: 'row',
								alignItems: 'flex-start',
								marginBottom: i < adaptiveInsights.predictedIssues.length - 1 ? 8 : 0,
							}}>
								<View style={{
									width: 24, height: 24, borderRadius: 12,
									backgroundColor: '#fbbf2418',
									alignItems: 'center', justifyContent: 'center',
									marginRight: 8, marginTop: 1,
								}}>
									<Text style={{ fontSize: 10, fontWeight: '800', color: '#d97706' }}>
										{pred.confidence}%
									</Text>
								</View>
								<View style={{ flex: 1 }}>
									<Text style={{ fontSize: 12, fontWeight: '600', color: colors.orangeShade7 }}>
										{pred.symptom}
									</Text>
									<Text style={{ fontSize: 10, color: colors.orangeShade4, marginTop: 1 }}>
										{pred.reason}
									</Text>
								</View>
							</View>
						))}
					</View>
				)}

				{/* No Issues */}
				{!hasIssues && (
					<View style={{
						alignItems: 'center',
						backgroundColor: '#4ade8012',
						borderRadius: 16,
						padding: 24,
						marginBottom: 16,
					}}>
						<Ionicons name="checkmark-circle" size={48} color="#4ade80" />
						<Text style={{ fontSize: 16, fontWeight: '700', color: '#16a34a', marginTop: 10 }}>
							{t('allSystemsNormal')}
						</Text>
						<Text style={{ fontSize: 13, color: colors.orangeShade5, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
							{t('goodCondition')}
						</Text>
					</View>
				)}

				{/* Diagnostic Cards */}
				{diagnosticResults.map((issue, index) => (
					<View
						key={`${issue.symptomId}_${index}`}
						style={{
							backgroundColor: colors.ivory1,
							borderRadius: 16,
							marginBottom: 16,
							borderWidth: 1,
							borderColor: getUrgencyColor(issue.urgency) + '30',
							overflow: 'hidden',
						}}
					>
						{/* Issue Header */}
						<View style={{
							backgroundColor: getUrgencyColor(issue.urgency) + '12',
							padding: 14,
							borderBottomWidth: 1,
							borderBottomColor: getUrgencyColor(issue.urgency) + '20',
						}}>
							<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
								<View style={{
									backgroundColor: getUrgencyColor(issue.urgency) + '20',
									paddingHorizontal: 8, paddingVertical: 3,
									borderRadius: 6,
								}}>
									<Text style={{
										fontSize: 10, fontWeight: '800',
										color: getUrgencyColor(issue.urgency),
										letterSpacing: 0.5,
									}}>
										{getTranslatedUrgencyLabel(issue.urgency)}
									</Text>
								</View>
								{/* Recurring badge */}
								{issue.recurrenceInfo && (
									<View style={{
										flexDirection: 'row',
										alignItems: 'center',
										backgroundColor: '#f8717118',
										paddingHorizontal: 7, paddingVertical: 3,
										borderRadius: 6,
									}}>
										<Ionicons name="repeat" size={10} color="#f87171" />
										<Text style={{ fontSize: 10, fontWeight: '700', color: '#f87171', marginLeft: 3 }}>
											{issue.recurrenceInfo.occurrences}x recurring
											{issue.recurrenceInfo.trend === 'worsening' ? ' ↑' : issue.recurrenceInfo.trend === 'improving' ? ' ↓' : ''}
										</Text>
									</View>
								)}
								{/* Urgency boosted badge */}
								{issue.originalUrgency && issue.urgency !== issue.originalUrgency && (
									<View style={{
										flexDirection: 'row',
										alignItems: 'center',
										backgroundColor: '#dc262618',
										paddingHorizontal: 7, paddingVertical: 3,
										borderRadius: 6,
									}}>
										<Ionicons name="arrow-up" size={10} color="#dc2626" />
										<Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626', marginLeft: 3 }}>
											{t('boosted')}
										</Text>
									</View>
								)}
								<Text style={{ fontSize: 11, color: colors.orangeShade5 }}>
									{issue.category}
								</Text>
							</View>
							<Text style={{ fontSize: 16, fontWeight: '700', color: colors.orangeShade7 }}>
								{(tDiag(issue.symptomId) && tDiag(issue.symptomId).title) || issue.title}
							</Text>
							<Text style={{ fontSize: 12, color: colors.orangeShade5, marginTop: 4, lineHeight: 17 }}>
								{(tDiag(issue.symptomId) && tDiag(issue.symptomId).description) || issue.description}
							</Text>
							{/* Adaptive learning note for recurring issues */}
							{issue.recurrenceInfo && (
								<View style={{
									flexDirection: 'row',
									alignItems: 'center',
									marginTop: 8,
									backgroundColor: 'rgba(0,0,0,0.04)',
									padding: 8,
									borderRadius: 8,
								}}>
									<Ionicons name="analytics" size={14} color={colors.orangeShade5} />
									<Text style={{ fontSize: 11, color: colors.orangeShade5, marginLeft: 6, flex: 1 }}>
										{t('reportedTimes')} {issue.recurrenceInfo.occurrences} {t('timesLabel')}
										{issue.recurrenceInfo.trend === 'worsening'
											? t('worseningNote')
											: issue.recurrenceInfo.trend === 'improving'
											? t('improvingNote')
											: t('monitorNote')
										}
									</Text>
								</View>
							)}
							{/* Category trend */}
							{issue.categoryTrend?.trend && issue.categoryTrend.trend !== 'insufficient_data' && issue.categoryTrend.trend !== 'stable' && (
								<View style={{
									flexDirection: 'row',
									alignItems: 'center',
									marginTop: 6,
								}}>
									<Ionicons
										name={issue.categoryTrend.trend === 'worsening' ? 'trending-up' : 'trending-down'}
										size={14}
										color={issue.categoryTrend.trend === 'worsening' ? '#dc2626' : '#16a34a'}
									/>
									<Text style={{
										fontSize: 11,
										color: issue.categoryTrend.trend === 'worsening' ? '#dc2626' : '#16a34a',
										fontWeight: '600',
										marginLeft: 4,
									}}>
										{issue.category}: {issue.categoryTrend.trend === 'worsening' ? t('gettingWorseLabel') : t('improvingLabel')} {t('overLast')} {issue.categoryTrend.dataPoints} {t('checkupsLabel')}
									</Text>
								</View>
							)}
						</View>

						{/* Actions */}
						<View style={{ padding: 14 }}>
							<Text style={{ fontSize: 12, fontWeight: '700', color: colors.orangeShade6, marginBottom: 10, letterSpacing: 0.5 }}>
								{t('recommendedActions')}
							</Text>
							{issue.actions.map((action, ai) => (
								<View
									key={ai}
									style={{
										flexDirection: 'row',
										marginBottom: ai < issue.actions.length - 1 ? 12 : 0,
										alignItems: 'flex-start',
									}}
								>
									<View style={{
										width: 32, height: 32, borderRadius: 8,
										backgroundColor: getUrgencyColor(issue.urgency) + '12',
										alignItems: 'center', justifyContent: 'center',
										marginRight: 10, marginTop: 2,
									}}>
										<Ionicons
											name={action.icon || 'construct'}
											size={16}
											color={getUrgencyColor(issue.urgency)}
										/>
									</View>
									<View style={{ flex: 1 }}>
										<Text style={{ fontSize: 13, fontWeight: '700', color: colors.orangeShade7 }}>
											{(tDiag(issue.symptomId) && tDiag(issue.symptomId).actions?.[ai]?.part) || action.part}
										</Text>
										<Text style={{ fontSize: 12, color: colors.orangeShade5, lineHeight: 17, marginTop: 2 }}>
											{(tDiag(issue.symptomId) && tDiag(issue.symptomId).actions?.[ai]?.action) || action.action}
										</Text>
									</View>
								</View>
							))}
						</View>
					</View>
				))}

				{/* Adaptive Learning Note */}
				<View style={{
					backgroundColor: colors.primary + '08',
					borderRadius: 12,
					padding: 14,
					marginTop: 4,
					flexDirection: 'row',
					alignItems: 'flex-start',
				}}>
					<Ionicons name="analytics" size={20} color={colors.primary} style={{ marginRight: 10, marginTop: 2 }} />
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 12, fontWeight: '700', color: colors.orangeShade7 }}>
							{t('adaptiveLearningActive')}
						</Text>
						<Text style={{ fontSize: 11, color: colors.orangeShade5, lineHeight: 16, marginTop: 4 }}>
							{adaptiveInsights?.totalSurveys > 0
								? `${language === 'en' ? 'Your motorcycle profile is learning from' : 'Natututo ang profile ng iyong motorsiklo mula sa'} ${adaptiveInsights.totalSurveys + 1} ${t('profileLearning')}`
								: t('startBuilding')
							}
						</Text>
					</View>
				</View>

				{/* Close Button */}
				<TouchableOpacity
					onPress={closeSurvey}
					style={{
						backgroundColor: colors.primary,
						paddingVertical: 14,
						borderRadius: 12,
						alignItems: 'center',
						marginTop: 16,
					}}
				>
					<Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
						{t('done')}
					</Text>
				</TouchableOpacity>
			</ScrollView>
		);
	};

	// ==================== MAIN RENDER ====================
	return (
		<View>
			{renderPromptCard()}
			{renderLastSurveySummary()}
			{renderSurveyModal()}
		</View>
	);
};

export default RideExperienceSurvey;
