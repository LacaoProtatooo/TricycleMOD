import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../common/theme';
import { styles } from './maintenanceStyles';

const OverdueCheckModal = ({
	visible,
	onClose,
	overdueItems,
	onComplete,
	onSkip,
}) => {
	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<View style={styles.modalOverlay}>
				<View style={styles.overdueModal}>
					<View style={styles.overdueModalHeader}>
						<Ionicons name="warning" size={32} color="#DC2626" />
						<Text style={styles.overdueModalTitle}>Maintenance Check Required</Text>
					</View>
					<Text style={styles.overdueModalSubtitle}>
						The following items are overdue. Please complete maintenance or provide a reason for deferral.
					</Text>
					
					<ScrollView style={styles.overdueList} showsVerticalScrollIndicator={false}>
						{overdueItems.map((item) => (
							<View key={item.key} style={styles.overdueItem}>
								<View style={styles.overdueItemHeader}>
									<Text style={styles.overdueItemName}>{item.name}</Text>
									<View style={styles.overdueBadge}>
										<Text style={styles.overdueBadgeText}>{item.reminderLabel}</Text>
									</View>
								</View>
								<Text style={styles.overdueItemNotes}>{item.notes}</Text>
								<View style={styles.overdueStats}>
									{item.daysOverdue > 0 && (
										<Text style={styles.overdueStatText}>
											<Ionicons name="calendar" size={12} color="#DC2626" /> {item.daysOverdue} days overdue
										</Text>
									)}
									{item.kmOverdue > 0 && (
										<Text style={styles.overdueStatText}>
											<Ionicons name="speedometer" size={12} color="#DC2626" /> {item.kmOverdue} km overdue
										</Text>
									)}
								</View>
								<View style={styles.overdueActions}>
									<TouchableOpacity 
										style={styles.completeBtn}
										onPress={() => onComplete(item)}
									>
										<Ionicons name="checkmark-circle" size={16} color="#FFF" />
										<Text style={styles.completeBtnText}>Mark Done</Text>
									</TouchableOpacity>
									<TouchableOpacity 
										style={styles.skipBtn}
										onPress={() => onSkip(item)}
									>
										<Ionicons name="time" size={16} color={colors.primary} />
										<Text style={styles.skipBtnText}>Defer</Text>
									</TouchableOpacity>
								</View>
							</View>
						))}
					</ScrollView>
					
					{overdueItems.length === 0 && (
						<TouchableOpacity 
							style={styles.modalCloseBtn}
							onPress={onClose}
						>
							<Text style={styles.modalCloseBtnText}>Close</Text>
						</TouchableOpacity>
					)}
				</View>
			</View>
		</Modal>
	);
};

export default OverdueCheckModal;
