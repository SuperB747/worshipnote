import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import './Snackbar.css';

const Snackbar = ({ isVisible, type, message, onClose }) => {
  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="snackbar-icon success" />;
      case 'error':
        return <AlertCircle className="snackbar-icon error" />;
      case 'loading':
        return <Loader2 className="snackbar-icon loading" />;
      default:
        return null;
    }
  };

  return (
    <div className={`snackbar ${type}`}>
      <div className="snackbar-content">
        {getIcon()}
        <span className="snackbar-message">{message}</span>
        <button 
          className="snackbar-close"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Snackbar;
