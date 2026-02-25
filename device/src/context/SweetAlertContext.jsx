/**
 * SweetAlertContext.jsx - Global alert context for SweetAlert-style notifications
 * 
 * Usage:
 * const { showAlert, showSuccess, showError, showConfirm, showWarning } = useSweetAlert();
 * 
 * showSuccess('Success!', 'Your action was completed.');
 * showError('Error', 'Something went wrong.');
 * showConfirm('Confirm', 'Are you sure?', () => { ... }, () => { ... });
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import SweetAlert from '../components/common/SweetAlert';

const SweetAlertContext = createContext(null);

export const useSweetAlert = () => {
  const context = useContext(SweetAlertContext);
  if (!context) {
    throw new Error('useSweetAlert must be used within a SweetAlertProvider');
  }
  return context;
};

export const SweetAlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    onConfirm: null,
    onCancel: null,
    autoClose: 0,
    confirmButtonColor: null,
  });

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback((config) => {
    setAlertState({
      visible: true,
      type: config.type || 'info',
      title: config.title || '',
      message: config.message || '',
      confirmText: config.confirmText || 'OK',
      cancelText: config.cancelText || 'Cancel',
      showCancel: config.showCancel || false,
      onConfirm: () => {
        hideAlert();
        config.onConfirm?.();
      },
      onCancel: () => {
        hideAlert();
        config.onCancel?.();
      },
      autoClose: config.autoClose || 0,
      confirmButtonColor: config.confirmButtonColor || null,
    });
  }, [hideAlert]);

  const showSuccess = useCallback((title, message, onConfirm, autoClose = 0) => {
    showAlert({
      type: 'success',
      title,
      message,
      onConfirm,
      autoClose,
    });
  }, [showAlert]);

  const showError = useCallback((title, message, onConfirm) => {
    showAlert({
      type: 'error',
      title,
      message,
      onConfirm,
    });
  }, [showAlert]);

  const showWarning = useCallback((title, message, onConfirm) => {
    showAlert({
      type: 'warning',
      title,
      message,
      onConfirm,
    });
  }, [showAlert]);

  const showInfo = useCallback((title, message, onConfirm, autoClose = 0) => {
    showAlert({
      type: 'info',
      title,
      message,
      onConfirm,
      autoClose,
    });
  }, [showAlert]);

  const showConfirm = useCallback((title, message, onConfirm, onCancel, options = {}) => {
    showAlert({
      type: 'question',
      title,
      message,
      showCancel: true,
      onConfirm,
      onCancel,
      confirmText: options.confirmText || 'Yes',
      cancelText: options.cancelText || 'No',
      confirmButtonColor: options.confirmButtonColor,
    });
  }, [showAlert]);

  const showDestructive = useCallback((title, message, onConfirm, onCancel) => {
    showAlert({
      type: 'warning',
      title,
      message,
      showCancel: true,
      onConfirm,
      onCancel,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonColor: '#dc3545',
    });
  }, [showAlert]);

  const value = {
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    showDestructive,
    hideAlert,
  };

  return (
    <SweetAlertContext.Provider value={value}>
      {children}
      <SweetAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
        showCancel={alertState.showCancel}
        onConfirm={alertState.onConfirm}
        onCancel={alertState.onCancel}
        autoClose={alertState.autoClose}
        confirmButtonColor={alertState.confirmButtonColor}
      />
    </SweetAlertContext.Provider>
  );
};

export default SweetAlertProvider;
