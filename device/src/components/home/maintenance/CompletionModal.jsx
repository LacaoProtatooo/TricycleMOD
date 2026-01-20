import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';
import { FALLBACK_COMPLETION_STATUS_OPTIONS } from './maintenanceConstants';

const CompletionModal = ({
	visible,
	onClose,
	item,
	odometerKm,
	onSubmit,
	statusOptions = FALLBACK_COMPLETION_STATUS_OPTIONS, // Accept dynamic options with fallback
}) => {
	const [status, setStatus] = useState('completed');
	const [reading, setReading] = useState('');
	const [notes, setNotes] = useState('');
	const [cost, setCost] = useState('');

	const handleSubmit = () => {
		onSubmit({
			status,
			reading: reading.trim() || null,
			notes: notes.trim() || `${status} via app`,
			cost: cost ? parseFloat(cost) : null,
			completedAt: new Date().toISOString(),
		});
		
		// Reset state
		setStatus('completed');
		setReading('');
		setNotes('');
		setCost('');
	};

	const handleClose = () => {
		setStatus('completed');
		setReading('');
		setNotes('');
		setCost('');
		onClose();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={handleClose}
		>
			<KeyboardAvoidingView 
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={styles.modalOverlay}
			>
				<ScrollView contentContainerStyle={styles.completionModalScroll}>
					<View style={styles.completionModal}>
						<View style={styles.completionModalHeader}>
							<Ionicons name="construct" size={28} color="#22C55E" />
							<Text style={styles.completionModalTitle}>Record Maintenance</Text>
						</View>
						
						{item && (
							<View style={styles.completionItemInfo}>
								<Text style={styles.completionItemName}>{item.name}</Text>
								<Text style={styles.completionItemGroup}>{item.group}</Text>
								<Text style={styles.completionItemNotes}>{item.notes}</Text>
							</View>
						)}
						
						{/* Current readings display */}
						<View style={styles.currentReadingsBox}>
							<View style={styles.readingRow}>
								<Ionicons name="speedometer-outline" size={16} color={colors.orangeShade6} />
								<Text style={styles.readingLabel}>Current Odometer:</Text>
								<Text style={styles.readingValue}>{odometerKm !== null ? `${Math.round(odometerKm)} km` : '—'}</Text>
							</View>
							<View style={styles.readingRow}>
								<Ionicons name="calendar-outline" size={16} color={colors.orangeShade6} />
								<Text style={styles.readingLabel}>Date & Time:</Text>
								<Text style={styles.readingValue}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</Text>
							</View>
						</View>

						{/* Status Selection */}
						<Text style={styles.completionLabel}>Maintenance Status *</Text>
						<View style={styles.statusOptionsRow}>
							{statusOptions.map((opt) => (
								<TouchableOpacity
									key={opt.id}
									style={[
										styles.statusOption,
										status === opt.id && styles.statusOptionSelected
									]}
									onPress={() => setStatus(opt.id)}
								>
									<Ionicons 
										name={opt.icon} 
										size={18} 
										color={status === opt.id ? '#FFF' : colors.orangeShade5} 
									/>
									<Text style={[
										styles.statusOptionText,
										status === opt.id && styles.statusOptionTextSelected
									]}>
										{opt.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						{/* Reading/Measurement Input */}
						<Text style={styles.completionLabel}>Reading / Measurement (optional)</Text>
						<TextInput
							style={styles.completionInput}
							placeholder="e.g., 32 PSI, 3.5L oil, 0.8mm gap..."
							placeholderTextColor={colors.orangeShade4}
							value={reading}
							onChangeText={setReading}
						/>

						{/* Cost Input */}
						<Text style={styles.completionLabel}>Cost (optional)</Text>
						<TextInput
							style={styles.completionInput}
							placeholder="e.g., 150"
							placeholderTextColor={colors.orangeShade4}
							value={cost}
							onChangeText={setCost}
							keyboardType="numeric"
						/>

						{/* Notes Input */}
						<Text style={styles.completionLabel}>Notes / Details (optional)</Text>
						<TextInput
							style={[styles.completionInput, styles.completionTextArea]}
							placeholder="Additional details about the maintenance performed..."
							placeholderTextColor={colors.orangeShade4}
							value={notes}
							onChangeText={setNotes}
							multiline
							numberOfLines={3}
						/>

						<View style={styles.completionModalActions}>
							<TouchableOpacity 
								style={styles.completionCancelBtn}
								onPress={handleClose}
							>
								<Text style={styles.completionCancelBtnText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity 
								style={styles.completionSubmitBtn}
								onPress={handleSubmit}
							>
								<Ionicons name="checkmark" size={18} color="#FFF" />
								<Text style={styles.completionSubmitBtnText}>Record</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default CompletionModal;
