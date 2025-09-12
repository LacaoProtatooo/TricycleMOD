import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MotorcycleModel, useAuth } from '@/main/AuthContext';
import { useRouter } from 'expo-router';

const MOTORCYCLES: MotorcycleModel[] = [
	'Yamaha RS 110/125',
	'Vega Force i',
	'Honda TMX 125',
	'Honda TMX 155',
	'Honda XRM 125',
	'Kawasaki Barako II (175cc)',
	'Suzuki Smash 115',
	'Suzuki Raider J 110/115',
];

export default function SelectMotorcycleScreen() {
	const colorScheme = useColorScheme();
	const router = useRouter();
	const { selectMotorcycle } = useAuth();

	function handleSelect(model: MotorcycleModel) {
		selectMotorcycle(model);
		router.replace('/(tabs)');
	}

	return (
		<ThemedView style={styles.container}>
			<ThemedText type="title" style={styles.title}>Select Motorcycle</ThemedText>
			<FlatList
				data={MOTORCYCLES}
				keyExtractor={(item) => item}
				renderItem={({ item }) => (
					<Pressable onPress={() => handleSelect(item)} style={[styles.item, { borderColor: Colors[colorScheme ?? 'light'].tint }] }>
						<View style={styles.itemInner}>
							<ThemedText style={styles.itemText}>{item}</ThemedText>
						</View>
					</Pressable>
				)}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
				contentContainerStyle={styles.list}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	title: {
		marginBottom: 12,
		color: '#FF7A00',
	},
	list: {
		paddingVertical: 8,
	},
	item: {
		borderWidth: 2,
		borderRadius: 12,
	},
	itemInner: {
		padding: 16,
	},
	itemText: {
		fontWeight: '600',
	},
	separator: {
		height: 12,
	},
}); 