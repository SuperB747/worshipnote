import { useState, useCallback } from 'react';

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState({
    isVisible: false,
    type: 'success',
    message: '',
  });

  const showSnackbar = useCallback((type, message, duration = 3000) => {
    setSnackbar({
      isVisible: true,
      type,
      message,
    });

    // 자동으로 숨기기
    if (duration > 0) {
      setTimeout(() => {
        hideSnackbar();
      }, duration);
    }
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar(prev => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  const showSuccess = useCallback((message, duration = 3000) => {
    showSnackbar('success', message, duration);
  }, [showSnackbar]);

  const showError = useCallback((message, duration = 5000) => {
    showSnackbar('error', message, duration);
  }, [showSnackbar]);

  const showLoading = useCallback((message, duration = 0) => {
    showSnackbar('loading', message, duration);
  }, [showSnackbar]);

  return {
    snackbar,
    showSnackbar,
    hideSnackbar,
    showSuccess,
    showError,
    showLoading,
  };
};
