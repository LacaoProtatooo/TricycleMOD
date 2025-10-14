import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
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
	
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	async function handleLogin() {
		if (!email || !password) {
			Alert.alert('Error', 'Please enter both email and password');
			return;
		}

		try {
			await login(email, password);
			Alert.alert('Success', 'Login successful!');
			router.replace('/(tabs)');
		} catch (error) {
			Alert.alert('Login Failed', error.message || 'Invalid email or password');
		}
	}

	return (
		<ThemedView style={styles.container}>
			<View style={styles.content}>
				<ThemedText type="title" style={styles.title}>TricycleMOD</ThemedText>
				<ThemedText style={styles.subtitle}>Driver & Operator Portal</ThemedText>

				<TextInput
					style={[styles.input, { 
						backgroundColor: Colors[colorScheme ?? 'light'].background,
						borderColor: Colors[colorScheme ?? 'light'].border,
						color: Colors[colorScheme ?? 'light'].text 
					}]}
					placeholder="Email"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
				/>

				<TextInput
					style={[styles.input, { 
						backgroundColor: Colors[colorScheme ?? 'light'].background,
						borderColor: Colors[colorScheme ?? 'light'].border,
						color: Colors[colorScheme ?? 'light'].text 
					}]}
					placeholder="Password"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={password}
					onChangeText={setPassword}
					secureTextEntry
				/>

				<Pressable onPress={handleLogin} style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
					<ThemedText style={styles.buttonText}>Login</ThemedText>
				</Pressable>

				<Pressable onPress={() => router.push('/signup')}>
					<ThemedText style={styles.linkText}>
						Don't have an account? Sign up
					</ThemedText>
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
		gap: 16,
	},
	title: {
		color: '#FF7A00',
		marginBottom: 4,
	},
	subtitle: {
		opacity: 0.8,
		marginBottom: 8,
	},
	input: {
		width: '100%',
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		fontSize: 16,
	},
	button: {
		paddingVertical: 14,
		paddingHorizontal: 18,
		borderRadius: 12,
		width: '100%',
		alignItems: 'center',
		marginTop: 8,
	},
	buttonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 16,
	},
	linkText: {
		color: '#FF7A00',
		marginTop: 16,
		textDecorationLine: 'underline',
	},
}); 