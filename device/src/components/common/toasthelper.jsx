// toasthelper.jsx

import Toast from 'react-native-toast-message';

const showToast = ({ type, text1, text2, props = {} }) => {
  Toast.show({
    type,
    text1,
    text2,
    ...props,
  });
};

// Exported toast methods
export const Toasthelper = {
  showSuccess: (message, description, extraProps = {}) =>
    showToast({ type: 'success', text1: message, text2: description, props: extraProps }),

  showError: (message, description, extraProps = {}) =>
    showToast({ type: 'error', text1: message, text2: description, props: extraProps }),

  showInfo: (message, description, extraProps = {}) =>
    showToast({ type: 'info', text1: message, text2: description, props: extraProps }),

  
};

export default Toasthelper;
