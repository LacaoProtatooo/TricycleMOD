import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/main/AuthContext';
import { Pressable } from 'react-native';

type UserRole = 'driver' | 'operator';

export default function SignupScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const { signup } = useAuth();
	
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [name, setName] = useState('');
	const [contactNumber, setContactNumber] = useState('');
	const [plateNumber, setPlateNumber] = useState('');
	const [selectedRole, setSelectedRole] = useState<UserRole>('driver');

	async function handleSignup() {
		// Basic validation
		if (!email || !password || !name || !contactNumber || !plateNumber) {
			Alert.alert('Error', 'Please fill in all required fields');
			return;
		}
		
		if (password !== confirmPassword) {
			Alert.alert('Error', 'Passwords do not match');
			return;
		}
		
		if (password.length < 6) {
			Alert.alert('Error', 'Password must be at least 6 characters');
			return;
		}

		try {
			// Sign up the user with their role
			await signup(email, password, name, contactNumber, plateNumber, selectedRole);
			Alert.alert('Success', 'Account created successfully!');
			router.replace('/(tabs)');
		} catch (error) {
			Alert.alert('Error', error.message || 'Failed to create account');
		}
	}

	function handleRoleSelection(role: UserRole) {
		setSelectedRole(role);
	}

	return (
		<ThemedView style={styles.container}>
			<View style={styles.content}>
				<ThemedText type="title" style={styles.title}>Create Account</ThemedText>
				<ThemedText style={styles.subtitle}>Join TricycleMOD</ThemedText>

				<TextInput
					style={[styles.input, { 
						backgroundColor: Colors[colorScheme ?? 'light'].background,
						borderColor: Colors[colorScheme ?? 'light'].border,
						color: Colors[colorScheme ?? 'light'].text 
					}]}
					placeholder="Full Name"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={name}
					onChangeText={setName}
					autoCapitalize="words"
				/>

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
					placeholder="Contact Number"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={contactNumber}
					onChangeText={setContactNumber}
					keyboardType="phone-pad"
				/>

				<TextInput
					style={[styles.input, { 
						backgroundColor: Colors[colorScheme ?? 'light'].background,
						borderColor: Colors[colorScheme ?? 'light'].border,
						color: Colors[colorScheme ?? 'light'].text 
					}]}
					placeholder="Plate Number"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={plateNumber}
					onChangeText={setPlateNumber}
					autoCapitalize="characters"
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

				<TextInput
					style={[styles.input, { 
						backgroundColor: Colors[colorScheme ?? 'light'].background,
						borderColor: Colors[colorScheme ?? 'light'].border,
						color: Colors[colorScheme ?? 'light'].text 
					}]}
					placeholder="Confirm Password"
					placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
					value={confirmPassword}
					onChangeText={setConfirmPassword}
					secureTextEntry
				/>

				<ThemedText style={styles.roleTitle}>Select Your Role:</ThemedText>
				
				<View style={styles.roleContainer}>
					<Pressable
						style={[
							styles.roleButton,
							{ 
								backgroundColor: selectedRole === 'driver' 
									? Colors[colorScheme ?? 'light'].tint 
									: Colors[colorScheme ?? 'light'].background,
								borderColor: Colors[colorScheme ?? 'light'].tint
							}
						]}
						onPress={() => handleRoleSelection('driver')}
					>
						<ThemedText style={[
							styles.roleText,
							{ color: selectedRole === 'driver' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text }
						]}>
							Driver
						</ThemedText>
						<ThemedText style={[
							styles.roleDescription,
							{ color: selectedRole === 'driver' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text + '80' }
						]}>
							Manage your motorcycle and maintenance
						</ThemedText>
					</Pressable>

					<Pressable
						style={[
							styles.roleButton,
							{ 
								backgroundColor: selectedRole === 'operator' 
									? Colors[colorScheme ?? 'light'].tint 
									: Colors[colorScheme ?? 'light'].background,
								borderColor: Colors[colorScheme ?? 'light'].tint
							}
						]}
						onPress={() => handleRoleSelection('operator')}
					>
						<ThemedText style={[
							styles.roleText,
							{ color: selectedRole === 'operator' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text }
						]}>
							Operator
						</ThemedText>
						<ThemedText style={[
							styles.roleDescription,
							{ color: selectedRole === 'operator' ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text + '80' }
						]}>
							Manage drivers and operations
						</ThemedText>
					</Pressable>
				</View>

				<Pressable 
					onPress={handleSignup} 
					style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
				>
					<ThemedText style={styles.buttonText}>Create Account</ThemedText>
				</Pressable>

				<Pressable onPress={() => router.back()}>
					<ThemedText style={styles.linkText}>
						Already have an account? Login
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
	roleTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginTop: 8,
		marginBottom: 8,
	},
	roleContainer: {
		width: '100%',
		gap: 12,
	},
	roleButton: {
		width: '100%',
		padding: 16,
		borderRadius: 12,
		borderWidth: 2,
		alignItems: 'center',
	},
	roleText: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 4,
	},
	roleDescription: {
		fontSize: 14,
		textAlign: 'center',
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
