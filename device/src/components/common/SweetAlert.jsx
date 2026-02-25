/**
 * SweetAlert.jsx - Beautiful alert/notification modal component
 * 
 * Provides SweetAlert-style modals for confirmations, success, error, warnings, and info
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Alert types with their icons and colors
const ALERT_TYPES = {
  success: {
    icon: 'checkmark-circle',
    color: '#28a745',
    bgColor: 'rgba(40, 167, 69, 0.1)',
  },
  error: {
    icon: 'close-circle',
    color: '#dc3545',
    bgColor: 'rgba(220, 53, 69, 0.1)',
  },
  warning: {
    icon: 'warning',
    color: '#ffc107',
    bgColor: 'rgba(255, 193, 7, 0.1)',
  },
  info: {
    icon: 'information-circle',
    color: '#17a2b8',
    bgColor: 'rgba(23, 162, 184, 0.1)',
  },
  question: {
    icon: 'help-circle',
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
  },
};

const SweetAlert = ({
  visible,
  type = 'info', // 'success' | 'error' | 'warning' | 'info' | 'question'
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = false,
  confirmButtonColor,
  cancelButtonColor,
  closeOnOverlayPress = true,
  autoClose = 0, // Auto close after X ms (0 = disabled)
  customIcon, // Optional custom icon name
  iconSize = 60,
  animationType = 'bounce', // 'bounce' | 'fade' | 'slide'
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;

  const alertConfig = ALERT_TYPES[type] || ALERT_TYPES.info;
  const btnColor = confirmButtonColor || alertConfig.color;

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Icon bounce animation
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close if enabled
      if (autoClose > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoClose);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
    }
  }, [visible, autoClose]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onCancel) onCancel();
    });
  };

  const handleConfirm = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      if (onConfirm) onConfirm();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={closeOnOverlayPress ? handleClose : undefined}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {/* Icon Circle */}
            <Animated.View
              style={[
                styles.iconCircle,
                { backgroundColor: alertConfig.bgColor },
                { transform: [{ scale: iconScaleAnim }] },
              ]}
            >
              <View style={[styles.iconInner, { backgroundColor: alertConfig.color }]}>
                <Ionicons
                  name={customIcon || alertConfig.icon}
                  size={iconSize * 0.5}
                  color="#fff"
                />
              </View>
            </Animated.View>

            {/* Title */}
            {title && <Text style={styles.title}>{title}</Text>}

            {/* Message */}
            {message && <Text style={styles.message}>{message}</Text>}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {showCancel && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    cancelButtonColor && { backgroundColor: cancelButtonColor },
                  ]}
                  onPress={handleClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  { backgroundColor: btnColor },
                  !showCancel && styles.fullWidthButton,
                ]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// Helper functions for quick alerts
export const showSuccess = (title, message, onClose) => {
  return { visible: true, type: 'success', title, message, onConfirm: onClose };
};

export const showError = (title, message, onClose) => {
  return { visible: true, type: 'error', title, message, onConfirm: onClose };
};

export const showWarning = (title, message, onClose) => {
  return { visible: true, type: 'warning', title, message, onConfirm: onClose };
};

export const showConfirm = (title, message, onConfirm, onCancel) => {
  return { 
    visible: true, 
    type: 'question', 
    title, 
    message, 
    showCancel: true,
    onConfirm,
    onCancel,
  };
};

export default SweetAlert;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: Math.min(SCREEN_WIDTH - 40, 340),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  fullWidthButton: {
    flex: 1,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
