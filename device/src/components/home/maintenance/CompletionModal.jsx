import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
	const [proofImage, setProofImage] = useState(null);
	const [uploading, setUploading] = useState(false);

	const pickImage = async () => {
		try {
			const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (permStatus !== 'granted') {
				Alert.alert('Permission Required', 'Please allow access to your photo library');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [4, 3],
				quality: 0.7,
				base64: true,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				setProofImage(result.assets[0]);
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to pick image');
		}
	};

	const takePhoto = async () => {
		try {
			const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
			if (permStatus !== 'granted') {
				Alert.alert('Permission Required', 'Please allow access to your camera');
				return;
			}

			const result = await ImagePicker.launchCameraAsync({
				allowsEditing: true,
				aspect: [4, 3],
				quality: 0.7,
				base64: true,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				setProofImage(result.assets[0]);
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to take photo');
		}
	};

	const removeImage = () => {
		setProofImage(null);
	};

	const handleSubmit = () => {
		setUploading(true);
		onSubmit({
			status,
			reading: reading.trim() || null,
			notes: notes.trim() || `${status} via app`,
			cost: cost ? parseFloat(cost) : null,
			completedAt: new Date().toISOString(),
			proofImage: proofImage ? {
				uri: proofImage.uri,
				base64: proofImage.base64,
				type: 'image/jpeg',
			} : null,
		});
		
		// Reset state
		setStatus('completed');
		setReading('');
		setNotes('');
		setCost('');
		setProofImage(null);
		setUploading(false);
	};

	const handleClose = () => {
		setStatus('completed');
		setReading('');
		setNotes('');
		setCost('');
		setProofImage(null);
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

						{/* Proof Photo Section */}
						<Text style={styles.completionLabel}>Proof Photo (recommended)</Text>
						<Text style={styles.proofHint}>Upload a photo as proof for operator verification</Text>
						
						{proofImage ? (
							<View style={styles.proofImageContainer}>
								<Image source={{ uri: proofImage.uri }} style={styles.proofImagePreview} />
								<TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
									<Ionicons name="close-circle" size={28} color="#EF4444" />
								</TouchableOpacity>
							</View>
						) : (
							<View style={styles.proofButtonsRow}>
								<TouchableOpacity style={styles.proofButton} onPress={takePhoto}>
									<Ionicons name="camera" size={24} color={colors.primary} />
									<Text style={styles.proofButtonText}>Take Photo</Text>
								</TouchableOpacity>
								<TouchableOpacity style={styles.proofButton} onPress={pickImage}>
									<Ionicons name="images" size={24} color={colors.primary} />
									<Text style={styles.proofButtonText}>Gallery</Text>
								</TouchableOpacity>
							</View>
						)}

						<View style={styles.completionModalActions}>
							<TouchableOpacity 
								style={styles.completionCancelBtn}
								onPress={handleClose}
								disabled={uploading}
							>
								<Text style={styles.completionCancelBtnText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity 
								style={[styles.completionSubmitBtn, uploading && { opacity: 0.7 }]}
								onPress={handleSubmit}
								disabled={uploading}
							>
								{uploading ? (
									<ActivityIndicator size="small" color="#FFF" />
								) : (
									<>
										<Ionicons name="checkmark" size={18} color="#FFF" />
										<Text style={styles.completionSubmitBtnText}>Submit</Text>
									</>
								)}
							</TouchableOpacity>
						</View>
						
						<Text style={styles.pendingApprovalNote}>
							<Ionicons name="information-circle" size={14} color="#F59E0B" /> Your maintenance will be submitted for operator approval
						</Text>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default CompletionModal;
