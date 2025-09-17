import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, Search, Calendar, Plus, Download, RotateCcw } from 'lucide-react';
import { createDatabaseBackup, restoreDatabaseFromBackup } from '../utils/storage';
import './Sidebar.css';

const Sidebar = ({ songs, worshipLists, setSongs, setWorshipLists, fileExistenceMap }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Plus, label: '악보 추가', color: '#4a7c59' },
    { path: '/search', icon: Search, label: '악보 검색', color: '#6b8e6b' },
    { path: '/worship-list', icon: Calendar, label: '찬양 리스트', color: '#8b7355' },
  ];

  const handleDatabaseBackup = async () => {
    try {
      console.log('통합 데이터베이스 백업 시작...');
      console.log('현재 songs 개수:', songs.length);
      console.log('현재 worshipLists 개수:', Object.keys(worshipLists).length);
      const result = await createDatabaseBackup(songs, worshipLists, fileExistenceMap);
      console.log('통합 데이터베이스 백업 결과:', result);
      
      if (result.success) {
        alert(`데이터베이스 백업이 생성되었습니다!\n${result.message}`);
      } else {
        alert('데이터베이스 백업 생성에 실패했습니다:\n' + result.error);
      }
    } catch (error) {
      console.error('데이터베이스 백업 생성 오류:', error);
      alert('데이터베이스 백업 생성 중 오류가 발생했습니다:\n' + error.message);
    }
  };

  const handleDatabaseRestore = () => {
    // 파일 선택을 위한 input 요소 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        console.log('데이터베이스 복원 시작...');
        
        // 파일을 직접 읽어서 처리
        const fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });

        // JSON 파싱
        let backupData;
        try {
          backupData = JSON.parse(fileContent);
        } catch (parseError) {
          throw new Error(`백업 파일 형식이 올바르지 않습니다: ${parseError.message}`);
        }

        // 백업 파일 형식 확인
        const isOldFormat = backupData.type === 'database';
        const isNewFormat = backupData.type === 'worshipnote_database';
        
        if (!isOldFormat && !isNewFormat) {
          throw new Error('올바른 WorshipNote 백업 파일이 아닙니다.');
        }
        
        if (!backupData.songs || !backupData.worshipLists) {
          throw new Error('백업 파일에 필요한 데이터가 없습니다.');
        }

        // 데이터 복원
        const songs = backupData.songs || [];
        const worshipLists = backupData.worshipLists || {};
        
        console.log('복원할 songs 개수:', songs.length);
        console.log('복원할 worshipLists 개수:', Object.keys(worshipLists).length);

        // 상태 업데이트
        setSongs(songs);
        setWorshipLists(worshipLists);

        // localStorage에 저장
        localStorage.setItem('worshipnote_data', JSON.stringify({
          songs,
          worshipLists
        }));

        // OneDrive에도 저장 (Electron API 사용 가능한 경우)
        if (window.electronAPI && window.electronAPI.writeFile) {
          try {
            const oneDrivePath = await window.electronAPI.getOneDrivePath();
            if (oneDrivePath) {
              const songsData = {
                songs,
                lastUpdated: new Date().toISOString()
              };
              const worshipListsData = {
                worshipLists,
                lastUpdated: new Date().toISOString()
              };

              await window.electronAPI.writeFile(`${oneDrivePath}/songs.json`, JSON.stringify(songsData, null, 2));
              await window.electronAPI.writeFile(`${oneDrivePath}/worship_lists.json`, JSON.stringify(worshipListsData, null, 2));
              console.log('OneDrive에 데이터 저장 완료');
            }
          } catch (oneDriveError) {
            console.warn('OneDrive 저장 실패:', oneDriveError);
          }
        }

        alert(`데이터베이스가 복원되었습니다!\n찬양: ${songs.length}개\n찬양 리스트: ${Object.keys(worshipLists).length}개`);
      } catch (error) {
        console.error('데이터베이스 복원 오류:', error);
        alert('데이터베이스 복원에 실패했습니다:\n' + error.message);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <Music className="logo-icon" />
          <span className="logo-text">WorshipNote</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{ '--item-color': item.color }}
            >
              <Icon className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="sidebar-data-management">
        <div className="data-management-title">데이터 관리</div>
        <div className="data-management-buttons">
          <button 
            className="data-btn backup-btn"
            onClick={handleDatabaseBackup}
            title="데이터베이스 백업"
          >
            <span className="btn-emoji">💾</span>
            <span className="btn-caption">백업</span>
          </button>
          <button 
            className="data-btn restore-btn"
            onClick={handleDatabaseRestore}
            title="데이터베이스 복원"
          >
            <span className="btn-emoji">🔄</span>
            <span className="btn-caption">복원</span>
          </button>
        </div>
      </div>
      
      <div className="sidebar-footer">
        <div className="app-version">v1.0.0</div>
      </div>
    </div>
  );
};

export default Sidebar;
