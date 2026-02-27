import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';
import { FALLBACK_COMPLETION_STATUS_OPTIONS, READING_OPTIONS_BY_KEY, DEFAULT_READING_OPTIONS } from './maintenanceConstants';

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
	const [readingDropdownOpen, setReadingDropdownOpen] = useState(false);
	const [notes, setNotes] = useState('');
	const [cost, setCost] = useState('');
	const [proofImage, setProofImage] = useState(null);
	const [uploading, setUploading] = useState(false);

	// Get reading options based on item key
	const itemKey = item?.key || '';
	const readingConfig = READING_OPTIONS_BY_KEY[itemKey] || DEFAULT_READING_OPTIONS;
	const selectedReadingOption = readingConfig.options.find(o => o.value === reading);

	// Reset state when modal opens with new item
	useEffect(() => {
		if (visible) {
			setStatus('completed');
			setReading('');
			setReadingDropdownOpen(false);
			setNotes('');
			setCost('');
			setProofImage(null);
			setUploading(false);
		}
	}, [visible, item]);

	// Color for reading status dot
	const getReadingColor = (value) => {
		const goodValues = ['good', 'clean', 'strong', 'normal', 'full', 'clear', 'in_spec', 'replaced', 'adjusted', 'adjusted_lubed', 'lubricated', 'cleaned', 'charged', 'topped_up', 'flushed', 'full_overhaul', 'gasket_replaced', 'sealed'];
		const warnValues = ['slightly_used', 'adequate', 'slightly_low', 'ok', 'dusty', 'oily', 'slightly_clogged', 'loose', 'tight', 'dry', 'sticky', 'soft', 'stiff', 'worn', 'thin', 'rich', 'lean', 'brittle', 'repaired', 'fair', 'serviced'];
		if (goodValues.includes(value)) return '#16A34A';
		if (warnValues.includes(value)) return '#D97706';
		return '#DC2626';
	};

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

	// Check if form is valid for submission
	const isFormValid = reading !== '';

	const handleSubmit = () => {
		if (!isFormValid) {
			Alert.alert('Required Field', 'Please select a condition/reading before submitting.');
			return;
		}
		setUploading(true);
		onSubmit({
			status,
			reading: selectedReadingOption ? selectedReadingOption.label : (reading.trim() || null),
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
		setReadingDropdownOpen(false);
		setNotes('');
		setCost('');
		setProofImage(null);
		setUploading(false);
	};

	const handleClose = () => {
		setStatus('completed');
		setReading('');
		setReadingDropdownOpen(false);
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
				behavior="height"
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

						{/* Reading/Measurement Dropdown */}
						<Text style={styles.completionLabel}>{readingConfig.label} *</Text>
						
						{/* Dropdown Trigger */}
						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => setReadingDropdownOpen(!readingDropdownOpen)}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								backgroundColor: colors.ivory4 || '#FAFAF2',
								borderRadius: readingDropdownOpen ? 10 : 10,
								borderBottomLeftRadius: readingDropdownOpen ? 0 : 10,
								borderBottomRightRadius: readingDropdownOpen ? 0 : 10,
								paddingHorizontal: 14,
								paddingVertical: 14,
								borderWidth: 1.5,
								borderColor: readingDropdownOpen ? colors.primary : (reading ? getReadingColor(reading) + '60' : (colors.ivory3 || '#E8E8D0')),
								marginBottom: readingDropdownOpen ? 0 : 12,
							}}
						>
							{selectedReadingOption ? (
								<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
									<View style={{
										width: 10, height: 10, borderRadius: 5,
										backgroundColor: getReadingColor(reading),
										marginRight: 10,
									}} />
									<Text style={{ fontSize: 14, fontWeight: '600', color: colors.orangeShade7, flex: 1 }} numberOfLines={1}>
										{selectedReadingOption.label}
									</Text>
								</View>
							) : (
								<Text style={{ fontSize: 14, color: colors.orangeShade4 || '#FFB74D' }}>
									Tap to select reading...
								</Text>
							)}
							<Ionicons 
								name={readingDropdownOpen ? "chevron-up" : "chevron-down"} 
								size={20} 
								color={colors.orangeShade5} 
							/>
						</TouchableOpacity>

						{/* Dropdown Options List */}
						{readingDropdownOpen && (
							<View style={{
								backgroundColor: colors.ivory1 || '#FFFFF0',
								borderWidth: 1.5,
								borderTopWidth: 0,
								borderColor: colors.primary,
								borderBottomLeftRadius: 10,
								borderBottomRightRadius: 10,
								marginBottom: 12,
								overflow: 'hidden',
							}}>
								{readingConfig.options.map((option, index) => {
									const isSelected = reading === option.value;
									const optColor = getReadingColor(option.value);
									return (
										<TouchableOpacity
											key={option.value}
											activeOpacity={0.7}
											onPress={() => {
												setReading(option.value);
												setReadingDropdownOpen(false);
											}}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingHorizontal: 14,
												paddingVertical: 13,
												backgroundColor: isSelected ? optColor + '12' : 'transparent',
												borderBottomWidth: index < readingConfig.options.length - 1 ? 1 : 0,
												borderBottomColor: (colors.ivory3 || '#E8E8D0') + '80',
											}}
										>
											<View style={{
												width: 10, height: 10, borderRadius: 5,
												backgroundColor: optColor,
											}} />
											<Text style={{
												fontSize: 14,
												color: isSelected ? optColor : colors.orangeShade7,
												fontWeight: isSelected ? '700' : '400',
												flex: 1,
												marginLeft: 10,
											}}>
												{option.label}
											</Text>
											{isSelected && (
												<Ionicons name="checkmark-circle" size={20} color={optColor} />
											)}
										</TouchableOpacity>
									);
								})}
							</View>
						)}

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
								style={[styles.completionSubmitBtn, (uploading || !isFormValid) && { opacity: 0.5 }]}
								onPress={handleSubmit}
								disabled={uploading || !isFormValid}
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
