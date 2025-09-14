import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type UserRole = 'driver' | 'operator';

export interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
}

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
	user: User | null;
	selectedMotorcycle: MotorcycleModel | null;
	odometerKm: number;
	maintenanceTasks: MaintenanceTaskDefinition[];
	maintenanceRecords: Record<MaintenanceTaskKey, MaintenanceRecord>;
	login: (email: string, password: string) => void;
	signup: (email: string, password: string, name: string, role: UserRole) => void;
	logout: () => void;
	selectMotorcycle: (model: MotorcycleModel) => void;
	addKilometers: (deltaKm: number) => void;
	markServiced: (task: MaintenanceTaskKey) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [user, setUser] = useState<User | null>(null);
	const [selectedMotorcycle, setSelectedMotorcycle] = useState<MotorcycleModel | null>(null);
	const [odometerKm, setOdometerKm] = useState<number>(0);
	const [maintenanceTasks] = useState<MaintenanceTaskDefinition[]>(DEFAULT_TASKS);
	const [maintenanceRecords, setMaintenanceRecords] = useState<Record<MaintenanceTaskKey, MaintenanceRecord>>({
		change_oil: { lastServicedKm: 0 },
		chain_lubrication: { lastServicedKm: 0 },
		tire_checkup: { lastServicedKm: 0 },
	});

	// Simple in-memory storage for demo purposes
	// In a real app, this would be stored in a database
	const [users, setUsers] = useState<User[]>([
		{ id: '1', email: 'driver@example.com', name: 'John Driver', role: 'driver' },
		{ id: '2', email: 'operator@example.com', name: 'Jane Operator', role: 'operator' },
	]);

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

	function login(email: string, password: string) {
		// Simple authentication - in a real app, this would validate against a secure backend
		const foundUser = users.find(u => u.email === email);
		if (foundUser) {
			setUser(foundUser);
			setIsAuthenticated(true);
		}
	}

	function signup(email: string, password: string, name: string, role: UserRole) {
		// Check if user already exists
		const existingUser = users.find(u => u.email === email);
		if (existingUser) {
			throw new Error('User already exists');
		}

		// Create new user
		const newUser: User = {
			id: Date.now().toString(),
			email,
			name,
			role,
		};

		setUsers(prev => [...prev, newUser]);
	}

	const value = useMemo<AuthState>(() => ({
		isAuthenticated,
		user,
		selectedMotorcycle,
		odometerKm,
		maintenanceTasks,
		maintenanceRecords,
		login,
		signup,
		logout: () => {
			setIsAuthenticated(false);
			setUser(null);
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
	}), [isAuthenticated, user, selectedMotorcycle, odometerKm, maintenanceTasks, maintenanceRecords, users]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
	return ctx;
} 