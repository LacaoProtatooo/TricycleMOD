import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/main/AuthContext';
import { Pressable } from 'react-native';

interface Driver {
	id: string;
	name: string;
	email: string;
	motorcycle: string;
	status: 'active' | 'inactive' | 'maintenance';
	lastTrip: string;
	odometer: number;
}

export default function OperatorDashboard() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const { user, logout } = useAuth();
	
	// Mock data for demonstration
	const [drivers] = useState<Driver[]>([
		{ id: '1', name: 'John Driver', email: 'john@example.com', motorcycle: 'Honda TMX 125', status: 'active', lastTrip: '2 hours ago', odometer: 15000 },
		{ id: '2', name: 'Maria Santos', email: 'maria@example.com', motorcycle: 'Yamaha RS 110', status: 'maintenance', lastTrip: '1 day ago', odometer: 8500 },
		{ id: '3', name: 'Pedro Cruz', email: 'pedro@example.com', motorcycle: 'Suzuki Smash 115', status: 'active', lastTrip: '30 min ago', odometer: 22000 },
		{ id: '4', name: 'Ana Garcia', email: 'ana@example.com', motorcycle: 'Honda XRM 125', status: 'inactive', lastTrip: '3 days ago', odometer: 12000 },
	]);

	const activeDrivers = drivers.filter(d => d.status === 'active').length;
	const driversInMaintenance = drivers.filter(d => d.status === 'maintenance').length;
	const totalTrips = drivers.reduce((sum, d) => sum + Math.floor(d.odometer / 10), 0); // Rough estimate

	function handleLogout() {
		Alert.alert(
			'Logout',
			'Are you sure you want to logout?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Logout', onPress: () => {
					logout();
					router.replace('/login');
				}}
			]
		);
	}

	function getStatusColor(status: Driver['status']) {
		switch (status) {
			case 'active': return '#4CAF50';
			case 'maintenance': return '#FF9800';
			case 'inactive': return '#F44336';
			default: return '#757575';
		}
	}

	function getStatusText(status: Driver['status']) {
		switch (status) {
			case 'active': return 'Active';
			case 'maintenance': return 'Maintenance';
			case 'inactive': return 'Inactive';
			default: return 'Unknown';
		}
	}

	return (
		<ThemedView style={styles.container}>
			<ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
				{/* Header */}
				<View style={styles.header}>
					<View>
						<ThemedText type="title" style={styles.title}>Operator Dashboard</ThemedText>
						<ThemedText style={styles.subtitle}>Welcome, {user?.name}</ThemedText>
					</View>
					<Pressable onPress={handleLogout} style={styles.logoutButton}>
						<ThemedText style={styles.logoutText}>Logout</ThemedText>
					</Pressable>
				</View>

				{/* Statistics Cards */}
				<View style={styles.statsContainer}>
					<View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
						<ThemedText type="title" style={[styles.statNumber, { color: '#4CAF50' }]}>{activeDrivers}</ThemedText>
						<ThemedText style={styles.statLabel}>Active Drivers</ThemedText>
					</View>
					
					<View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
						<ThemedText type="title" style={[styles.statNumber, { color: '#FF9800' }]}>{driversInMaintenance}</ThemedText>
						<ThemedText style={styles.statLabel}>In Maintenance</ThemedText>
					</View>
					
					<View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
						<ThemedText type="title" style={[styles.statNumber, { color: '#2196F3' }]}>{totalTrips}</ThemedText>
						<ThemedText style={styles.statLabel}>Total Trips</ThemedText>
					</View>
				</View>

				{/* Drivers List */}
				<View style={styles.section}>
					<ThemedText type="subtitle" style={styles.sectionTitle}>Driver Management</ThemedText>
					
					{drivers.map((driver) => (
						<View key={driver.id} style={[styles.driverCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
							<View style={styles.driverInfo}>
								<View style={styles.driverHeader}>
									<ThemedText style={styles.driverName}>{driver.name}</ThemedText>
									<View style={[styles.statusBadge, { backgroundColor: getStatusColor(driver.status) }]}>
										<ThemedText style={styles.statusText}>{getStatusText(driver.status)}</ThemedText>
									</View>
								</View>
								
								<ThemedText style={styles.driverEmail}>{driver.email}</ThemedText>
								<ThemedText style={styles.driverMotorcycle}>{driver.motorcycle}</ThemedText>
								
								<View style={styles.driverStats}>
									<ThemedText style={styles.driverStat}>Odometer: {driver.odometer.toLocaleString()} km</ThemedText>
									<ThemedText style={styles.driverStat}>Last trip: {driver.lastTrip}</ThemedText>
								</View>
							</View>
							
							<View style={styles.driverActions}>
								<Pressable style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
									<ThemedText style={styles.actionButtonText}>View</ThemedText>
								</Pressable>
								<Pressable style={[styles.actionButton, styles.secondaryButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
									<ThemedText style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Edit</ThemedText>
								</Pressable>
							</View>
						</View>
					))}
				</View>

				{/* Quick Actions */}
				<View style={styles.section}>
					<ThemedText type="subtitle" style={styles.sectionTitle}>Quick Actions</ThemedText>
					
					<View style={styles.actionsContainer}>
						<Pressable style={[styles.quickAction, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
							<ThemedText style={styles.quickActionText}>Add Driver</ThemedText>
						</Pressable>
						
						<Pressable style={[styles.quickAction, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].tint }]}>
							<ThemedText style={[styles.quickActionText, { color: Colors[colorScheme ?? 'light'].tint }]}>View Reports</ThemedText>
						</Pressable>
						
						<Pressable style={[styles.quickAction, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].tint }]}>
							<ThemedText style={[styles.quickActionText, { color: Colors[colorScheme ?? 'light'].tint }]}>Maintenance</ThemedText>
						</Pressable>
					</View>
				</View>
			</ScrollView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		paddingTop: 60,
	},
	title: {
		color: '#FF7A00',
	},
	subtitle: {
		opacity: 0.8,
		marginTop: 4,
	},
	logoutButton: {
		padding: 8,
		borderRadius: 8,
	},
	logoutText: {
		color: '#FF7A00',
		fontWeight: '600',
	},
	statsContainer: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		gap: 12,
		marginBottom: 24,
	},
	statCard: {
		flex: 1,
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
	},
	statNumber: {
		fontSize: 24,
		fontWeight: 'bold',
	},
	statLabel: {
		fontSize: 12,
		opacity: 0.8,
		marginTop: 4,
		textAlign: 'center',
	},
	section: {
		paddingHorizontal: 20,
		marginBottom: 24,
	},
	sectionTitle: {
		marginBottom: 16,
		fontWeight: '600',
	},
	driverCard: {
		padding: 16,
		borderRadius: 12,
		marginBottom: 12,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
	},
	driverInfo: {
		flex: 1,
	},
	driverHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	driverName: {
		fontSize: 16,
		fontWeight: '600',
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	statusText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '600',
	},
	driverEmail: {
		fontSize: 14,
		opacity: 0.8,
		marginBottom: 4,
	},
	driverMotorcycle: {
		fontSize: 14,
		fontWeight: '500',
		marginBottom: 8,
	},
	driverStats: {
		flexDirection: 'row',
		gap: 16,
	},
	driverStat: {
		fontSize: 12,
		opacity: 0.7,
	},
	driverActions: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 12,
	},
	actionButton: {
		flex: 1,
		padding: 8,
		borderRadius: 8,
		alignItems: 'center',
	},
	secondaryButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
	},
	actionButtonText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '600',
	},
	actionsContainer: {
		flexDirection: 'row',
		gap: 12,
	},
	quickAction: {
		flex: 1,
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
		borderWidth: 1,
	},
	quickActionText: {
		color: '#FFFFFF',
		fontWeight: '600',
	},
});
