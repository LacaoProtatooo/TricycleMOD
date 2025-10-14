import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import apiService from '../services/api';

export type UserRole = 'driver' | 'operator';

export interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	plateNumber?: string;
	address?: string;
	contactNumber?: string;
	operatorName?: string;
	driverPicture?: string;
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
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	signup: (email: string, password: string, name: string, contactNumber: string, plateNumber: string, role?: UserRole) => Promise<void>;
	logout: () => Promise<void>;
	selectMotorcycle: (model: MotorcycleModel) => void;
	addKilometers: (deltaKm: number) => void;
	markServiced: (task: MaintenanceTaskKey) => void;
	updateProfile: (profileData: Partial<Pick<User, 'plateNumber' | 'address' | 'contactNumber' | 'operatorName' | 'driverPicture'>>) => Promise<void>;
	loadUser: () => Promise<void>;
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
	const [loading, setLoading] = useState<boolean>(false);

	// Load user on app start
	useEffect(() => {
		loadUser();
	}, []);

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

	async function loadUser() {
		try {
			setLoading(true);
			// Check if we have a token in storage first
			const token = await getStoredToken();
			if (!token) {
				setIsAuthenticated(false);
				setUser(null);
				return;
			}
			
			apiService.setToken(token);
			const response = await apiService.getCurrentUser();
			if (response.user) {
				setUser(response.user);
				setIsAuthenticated(true);
			}
		} catch (error) {
			console.error('Failed to load user:', error);
			setIsAuthenticated(false);
			setUser(null);
			// Clear invalid token
			await clearStoredToken();
			apiService.setToken(null);
		} finally {
			setLoading(false);
		}
	}

	// Helper functions for token storage
	async function getStoredToken(): Promise<string | null> {
		try {
			// Using AsyncStorage for token persistence
			const AsyncStorage = require('@react-native-async-storage/async-storage').default;
			return await AsyncStorage.getItem('auth_token');
		} catch (error) {
			console.error('Failed to get stored token:', error);
			return null;
		}
	}

	async function storeToken(token: string) {
		try {
			const AsyncStorage = require('@react-native-async-storage/async-storage').default;
			await AsyncStorage.setItem('auth_token', token);
		} catch (error) {
			console.error('Failed to store token:', error);
		}
	}

	async function clearStoredToken() {
		try {
			const AsyncStorage = require('@react-native-async-storage/async-storage').default;
			await AsyncStorage.removeItem('auth_token');
		} catch (error) {
			console.error('Failed to clear stored token:', error);
		}
	}

	async function updateProfile(profileData: Partial<Pick<User, 'plateNumber' | 'address' | 'contactNumber' | 'operatorName' | 'driverPicture'>>) {
		try {
			setLoading(true);
			const response = await apiService.updateProfile(profileData);
			if (response.user) {
				setUser(response.user);
			}
		} catch (error) {
			console.error('Failed to update profile:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	}

	async function login(email: string, password: string) {
		try {
			setLoading(true);
			const response = await apiService.login(email, password);
			if (response.user && response.token) {
				await storeToken(response.token);
				setUser(response.user);
				setIsAuthenticated(true);
			}
		} catch (error) {
			console.error('Login failed:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	}

	async function signup(email: string, password: string, name: string, contactNumber: string, plateNumber: string, role: UserRole = 'driver') {
		try {
			setLoading(true);
			const response = await apiService.register({
				email,
				password,
				name,
				contactNumber,
				plateNumber,
				role
			});
			if (response.user && response.token) {
				await storeToken(response.token);
				setUser(response.user);
				setIsAuthenticated(true);
			}
		} catch (error) {
			console.error('Signup failed:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	}

	async function logout() {
		try {
			setLoading(true);
			await apiService.logout();
			await clearStoredToken();
			apiService.setToken(null);
		} catch (error) {
			console.error('Logout failed:', error);
		} finally {
			setIsAuthenticated(false);
			setUser(null);
			setSelectedMotorcycle(null);
			setOdometerKm(0);
			setMaintenanceRecords({
				change_oil: { lastServicedKm: 0 },
				chain_lubrication: { lastServicedKm: 0 },
				tire_checkup: { lastServicedKm: 0 },
			});
			setLoading(false);
		}
	}

	const value = useMemo<AuthState>(() => ({
		isAuthenticated,
		user,
		selectedMotorcycle,
		odometerKm,
		maintenanceTasks,
		maintenanceRecords,
		loading,
		login,
		signup,
		logout,
		selectMotorcycle: (model: MotorcycleModel) => setSelectedMotorcycle(model),
		addKilometers,
		markServiced,
		updateProfile,
		loadUser,
	}), [isAuthenticated, user, selectedMotorcycle, odometerKm, maintenanceTasks, maintenanceRecords, loading]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
	return ctx;
} 