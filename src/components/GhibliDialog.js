import React from 'react';
import { CheckCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';
import './GhibliDialog.css';

const GhibliDialog = ({ 
  isVisible, 
  type = 'success', 
  title, 
  message, 
  onClose, 
  showCloseButton = true,
  autoClose = false,
  autoCloseDelay = 3000
}) => {
  React.useEffect(() => {
    if (isVisible && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, autoCloseDelay, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="dialog-icon success-icon" />;
      case 'error':
        return <AlertCircle className="dialog-icon error-icon" />;
      case 'info':
        return <Info className="dialog-icon info-icon" />;
      case 'loading':
        return <Sparkles className="dialog-icon loading-icon" />;
      default:
        return <CheckCircle className="dialog-icon success-icon" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    
    switch (type) {
      case 'success':
        return '성공!';
      case 'error':
        return '오류 발생';
      case 'info':
        return '알림';
      case 'loading':
        return '처리 중...';
      default:
        return '알림';
    }
  };

  return (
    <div className="ghibli-dialog-overlay">
      <div className="ghibli-dialog-container">
        <div className="ghibli-dialog">
          <div className="ghibli-dialog-header">
            <div className="ghibli-dialog-title">
              {getIcon()}
              <span>{getTitle()}</span>
            </div>
            {showCloseButton && (
              <button 
                className="ghibli-dialog-close"
                onClick={onClose}
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            )}
          </div>
          
          <div className="ghibli-dialog-content">
            <p className="ghibli-dialog-message">{message}</p>
          </div>
          
          <div className="ghibli-dialog-footer">
            <button 
              className="ghibli-dialog-button"
              onClick={onClose}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GhibliDialog;
