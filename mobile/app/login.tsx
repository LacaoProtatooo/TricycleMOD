import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/main/AuthContext';
import { Pressable } from 'react-native';

export default function LoginScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const { login } = useAuth();

	function handleLogin() {
		login();
		router.replace('/select-motorcycle');
	}

	return (
		<ThemedView style={styles.container}>
			<View style={styles.content}>
				<ThemedText type="title" style={styles.title}>TricycleMOD</ThemedText>
				<ThemedText style={styles.subtitle}>Driver & Operator Portal</ThemedText>
				<Pressable onPress={handleLogin} style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
					<ThemedText style={styles.buttonText}>Login</ThemedText>
				</Pressable>
			</View>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	content: {
		width: '100%',
		maxWidth: 420,
		alignItems: 'center',
		gap: 12,
	},
	title: {
		color: '#FF7A00',
	},
	subtitle: {
		opacity: 0.8,
		marginBottom: 8,
	},
	button: {
		paddingVertical: 14,
		paddingHorizontal: 18,
		borderRadius: 12,
		width: '100%',
		alignItems: 'center',
	},
	buttonText: {
		color: '#FFFFFF',
		fontWeight: '600',
	},
}); 