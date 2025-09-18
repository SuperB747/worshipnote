import React from 'react';
import './SyncAnimation.css';

const SyncAnimation = ({ isVisible, message = "OneDrive에서 최신 데이터를 동기화하는 중..." }) => {
  if (!isVisible) return null;

  return (
    <div className="sync-overlay">
      <div className="sync-container">
        <div className="sync-icon">
          <div className="sync-circle">
            <div className="sync-arrow sync-arrow-1">↗</div>
            <div className="sync-arrow sync-arrow-2">↘</div>
          </div>
        </div>
        <div className="sync-message">{message}</div>
        <div className="sync-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
};

export default SyncAnimation;
