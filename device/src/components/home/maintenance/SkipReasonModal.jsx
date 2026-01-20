import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';
import { FALLBACK_SKIP_REASON_OPTIONS } from './maintenanceConstants';

const SkipReasonModal = ({
	visible,
	onClose,
	item,
	onSubmit,
	onCancel,
	skipReasonOptions = FALLBACK_SKIP_REASON_OPTIONS, // Accept dynamic options with fallback
}) => {
	const [selectedReason, setSelectedReason] = useState(null);
	const [customReason, setCustomReason] = useState('');

	const handleSubmit = () => {
		if (!selectedReason) {
			Alert.alert('Required', 'Please select a reason for skipping maintenance.');
			return;
		}
		
		if (selectedReason === 'other' && !customReason.trim()) {
			Alert.alert('Required', 'Please enter your reason.');
			return;
		}
		
		const reasonText = selectedReason === 'other' 
			? customReason.trim() 
			: skipReasonOptions.find(r => r.id === selectedReason)?.label || selectedReason;
		
		onSubmit({
			reasonId: selectedReason,
			reason: reasonText,
		});
		
		// Reset state
		setSelectedReason(null);
		setCustomReason('');
	};

	const handleCancel = () => {
		setSelectedReason(null);
		setCustomReason('');
		onCancel();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={handleCancel}
		>
			<KeyboardAvoidingView 
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={styles.modalOverlay}
			>
				<View style={styles.skipModal}>
					<View style={styles.skipModalHeader}>
						<Ionicons name="help-circle" size={28} color={colors.primary} />
						<Text style={styles.skipModalTitle}>Why is maintenance being deferred?</Text>
					</View>
					
					{item && (
						<View style={styles.skipItemInfo}>
							<Text style={styles.skipItemName}>{item.name}</Text>
							<Text style={styles.skipItemOverdue}>
								{item.daysOverdue > 0 ? `${item.daysOverdue} days overdue` : ''}
								{item.daysOverdue > 0 && item.kmOverdue > 0 ? ' · ' : ''}
								{item.kmOverdue > 0 ? `${item.kmOverdue} km overdue` : ''}
							</Text>
						</View>
					)}
					
					<Text style={styles.skipReasonLabel}>Select a reason:</Text>
					<ScrollView style={styles.skipReasonList} showsVerticalScrollIndicator={false}>
						{skipReasonOptions.map((option) => (
							<TouchableOpacity
								key={option.id}
								style={[
									styles.skipReasonOption,
									selectedReason === option.id && styles.skipReasonOptionSelected
								]}
								onPress={() => setSelectedReason(option.id)}
							>
								<Ionicons 
									name={option.icon} 
									size={20} 
									color={selectedReason === option.id ? colors.primary : colors.orangeShade5} 
								/>
								<Text style={[
									styles.skipReasonOptionText,
									selectedReason === option.id && styles.skipReasonOptionTextSelected
								]}>
									{option.label}
								</Text>
								{selectedReason === option.id && (
									<Ionicons name="checkmark-circle" size={20} color={colors.primary} />
								)}
							</TouchableOpacity>
						))}
					</ScrollView>
					
					{selectedReason === 'other' && (
						<TextInput
							style={styles.customReasonInput}
							placeholder="Please specify your reason..."
							placeholderTextColor={colors.orangeShade4}
							value={customReason}
							onChangeText={setCustomReason}
							multiline
							numberOfLines={3}
						/>
					)}
					
					<View style={styles.skipModalActions}>
						<TouchableOpacity 
							style={styles.skipCancelBtn}
							onPress={handleCancel}
						>
							<Text style={styles.skipCancelBtnText}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity 
							style={[
								styles.skipSubmitBtn,
								!selectedReason && styles.skipSubmitBtnDisabled
							]}
							onPress={handleSubmit}
							disabled={!selectedReason}
						>
							<Text style={styles.skipSubmitBtnText}>Submit</Text>
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default SkipReasonModal;
