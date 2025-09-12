import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type MotorcycleModel =
	| 'Yamaha RS 110/125'
	| 'Vega Force i'
	| 'Honda TMX 125'
	| 'Honda TMX 155'
	| 'Honda XRM 125'
	| 'Kawasaki Barako II (175cc)'
	| 'Suzuki Smash 115'
	| 'Suzuki Raider J 110/115';

export type MaintenanceTaskKey = 'change_oil' | 'chain_lubrication' | 'tire_checkup';

export interface MaintenanceTaskDefinition {
	key: MaintenanceTaskKey;
	title: string;
	intervalKm: number;
}

export interface MaintenanceRecord {
	lastServicedKm: number;
}

const DEFAULT_TASKS: MaintenanceTaskDefinition[] = [
	{ key: 'change_oil', title: 'Change Oil', intervalKm: 3000 },
	{ key: 'chain_lubrication', title: 'Chain Lubrication', intervalKm: 800 },
	{ key: 'tire_checkup', title: 'Tire Checkup', intervalKm: 2000 },
];

interface AuthState {
	isAuthenticated: boolean;
	selectedMotorcycle: MotorcycleModel | null;
	odometerKm: number;
	maintenanceTasks: MaintenanceTaskDefinition[];
	maintenanceRecords: Record<MaintenanceTaskKey, MaintenanceRecord>;
	login: () => void;
	logout: () => void;
	selectMotorcycle: (model: MotorcycleModel) => void;
	addKilometers: (deltaKm: number) => void;
	markServiced: (task: MaintenanceTaskKey) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [selectedMotorcycle, setSelectedMotorcycle] = useState<MotorcycleModel | null>(null);
	const [odometerKm, setOdometerKm] = useState<number>(0);
	const [maintenanceTasks] = useState<MaintenanceTaskDefinition[]>(DEFAULT_TASKS);
	const [maintenanceRecords, setMaintenanceRecords] = useState<Record<MaintenanceTaskKey, MaintenanceRecord>>({
		change_oil: { lastServicedKm: 0 },
		chain_lubrication: { lastServicedKm: 0 },
		tire_checkup: { lastServicedKm: 0 },
	});

	function addKilometers(deltaKm: number) {
		if (!Number.isFinite(deltaKm)) return;
		setOdometerKm((prev) => Math.max(0, prev + Math.max(0, Math.floor(deltaKm))));
	}

	function markServiced(task: MaintenanceTaskKey) {
		setMaintenanceRecords((prev) => ({
			...prev,
			[task]: { lastServicedKm: odometerKm },
		}));
	}

	const value = useMemo<AuthState>(() => ({
		isAuthenticated,
		selectedMotorcycle,
		odometerKm,
		maintenanceTasks,
		maintenanceRecords,
		login: () => setIsAuthenticated(true),
		logout: () => {
			setIsAuthenticated(false);
			setSelectedMotorcycle(null);
			setOdometerKm(0);
			setMaintenanceRecords({
				change_oil: { lastServicedKm: 0 },
				chain_lubrication: { lastServicedKm: 0 },
				tire_checkup: { lastServicedKm: 0 },
			});
		},
		selectMotorcycle: (model: MotorcycleModel) => setSelectedMotorcycle(model),
		addKilometers,
		markServiced,
	}), [isAuthenticated, selectedMotorcycle, odometerKm, maintenanceTasks, maintenanceRecords]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
	return ctx;
} 