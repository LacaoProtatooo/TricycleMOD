// This file now contains only helper functions that don't involve API calls
// API calls have been moved to Redux actions

import { Alert } from 'react-native';

export const validateTricycleData = (tricycleData) => {
  const errors = [];
  
  if (!tricycleData.plateNumber?.trim()) {
    errors.push('Plate number is required');
  }
  
  if (!tricycleData.model?.trim()) {
    errors.push('Model is required');
  }
  
  if (tricycleData.currentOdometer && isNaN(parseFloat(tricycleData.currentOdometer))) {
    errors.push('Odometer must be a valid number');
  }
  
  return errors;
};

export const formatScheduleDays = (days) => {
  if (!days || days.length === 0) return 'No schedule';
  return days.join(', ');
};

export const formatScheduleTime = (schedule) => {
  if (!schedule) return '';
  return `${schedule.startTime} - ${schedule.endTime}`;
};

export const getDriverName = (driver) => {
  if (!driver) return 'Unassigned';
  return `${driver.firstname || ''} ${driver.lastname || ''}`.trim();
};

export const getDriverImage = (driver) => {
  return driver?.image?.url || null;
};

export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'available':
    case 'approved':
      return 'green';
    case 'maintenance':
    case 'pending':
      return 'orange';
    case 'unavailable':
    case 'rejected':
      return 'red';
    default:
      return 'gray';
  }
};

// Helper for FormData creation in receipt scanning
export const createImageFormData = (imageUri, fieldName = 'image') => {
  const formData = new FormData();
  const uriParts = imageUri.split('/');
  const name = uriParts[uriParts.length - 1];
  
  formData.append(fieldName, {
    uri: imageUri,
    name,
    type: 'image/jpeg',
  });
  
  return formData;
};

// Helper for schedule validation
export const validateSchedule = (schedule) => {
  const errors = [];
  
  if (!schedule.days || schedule.days.length === 0) {
    errors.push('At least one day must be selected');
  }
  
  if (!schedule.startTime || !schedule.endTime) {
    errors.push('Start and end times are required');
  }
  
  // Validate time format (simple check)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (schedule.startTime && !timeRegex.test(schedule.startTime)) {
    errors.push('Start time must be in HH:MM format');
  }
  
  if (schedule.endTime && !timeRegex.test(schedule.endTime)) {
    errors.push('End time must be in HH:MM format');
  }
  
  return errors;
};