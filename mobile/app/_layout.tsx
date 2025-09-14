import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/main/AuthContext';
import React, { useEffect } from 'react';

function AuthGate() {
	const { isAuthenticated, user, selectedMotorcycle } = useAuth();
	const router = useRouter();
	const segments = useSegments();

	useEffect(() => {
		if (!isAuthenticated) {
			if (segments[0] !== 'login' && segments[0] !== 'signup') router.replace('/login');
			return;
		}

		// Route based on user role
		if (isAuthenticated && user) {
			if (user.role === 'operator') {
				if (segments[0] !== 'operator-dashboard') router.replace('/operator-dashboard');
			} else if (user.role === 'driver') {
				if (!selectedMotorcycle) {
					if (segments[0] !== 'select-motorcycle') router.replace('/select-motorcycle');
				} else {
					if (segments[0] !== '(tabs)') router.replace('/(tabs)');
				}
			}
		}
	}, [isAuthenticated, user, selectedMotorcycle, segments]);

	return null;
}

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});

	if (!loaded) {
		// Async font loading only occurs in development.
		return null;
	}

	return (
		<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
			<AuthProvider>
				<Stack>
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
					<Stack.Screen name="login" options={{ headerShown: false }} />
					<Stack.Screen name="signup" options={{ headerShown: false }} />
					<Stack.Screen name="select-motorcycle" options={{ title: 'Select Motorcycle' }} />
					<Stack.Screen name="operator-dashboard" options={{ headerShown: false }} />
					<Stack.Screen name="+not-found" />
				</Stack>
				<StatusBar style="auto" />
				<AuthGate />
			</AuthProvider>
		</ThemeProvider>
	);
}
