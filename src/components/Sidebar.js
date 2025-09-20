import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, Search, Calendar, Plus, Download, RotateCcw, Clock } from 'lucide-react';
import { createDatabaseBackup, restoreDatabaseFromBackup, getDatabaseLastUpdated } from '../utils/storage';
import GhibliDialog from './GhibliDialog';
import './Sidebar.css';

const Sidebar = ({ songs, worshipLists, setSongs, setWorshipLists, fileExistenceMap }) => {
  const location = useLocation();
  const [dialog, setDialog] = useState({ isVisible: false, type: 'success', message: '' });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 백업 데이터 처리 함수
  const processBackupData = async (fileContent) => {
    // JSON 파싱
    let backupData;
    try {
      backupData = JSON.parse(fileContent);
      console.log('JSON 파싱 성공, 백업 데이터:', backupData);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('파일 내용 (처음 200자):', fileContent ? fileContent.substring(0, 200) : '파일 내용 없음');
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
    
    console.log('복원할 데이터:', { songsCount: songs.length, worshipListsCount: Object.keys(worshipLists).length });

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
          // WorshipNote_Data/Database 디렉토리 생성
          const dataDirPath = `${oneDrivePath}/WorshipNote_Data`;
          const databaseDirPath = `${dataDirPath}/Database`;
          
          try {
            await window.electronAPI.createDirectory(dataDirPath);
            await window.electronAPI.createDirectory(databaseDirPath);
          } catch (dirError) {
            if (!dirError.message.includes('already exists')) {
              console.warn('디렉토리 생성 실패:', dirError);
            }
          }

          const songsData = {
            songs,
            lastUpdated: new Date().toISOString()
          };
          const worshipListsData = {
            worshipLists,
            lastUpdated: new Date().toISOString()
          };

          // Database 폴더에 저장
          await window.electronAPI.writeFile(`${databaseDirPath}/songs.json`, JSON.stringify(songsData, null, 2));
          await window.electronAPI.writeFile(`${databaseDirPath}/worship_lists.json`, JSON.stringify(worshipListsData, null, 2));
          
        }
      } catch (oneDriveError) {
        console.warn('OneDrive 저장 실패:', oneDriveError);
      }
    }

    setDialog({
      isVisible: true,
      type: 'success',
      message: `데이터베이스가 복원되었습니다!\n\n찬양: ${songs.length}개\n찬양 리스트: ${Object.keys(worshipLists).length}개`
    });
  };

  const menuItems = [
    { path: '/', icon: Search, label: '악보 검색', color: '#6b8e6b' },
    { path: '/add', icon: Plus, label: '악보 추가', color: '#4a7c59' },
    { path: '/worship-list', icon: Calendar, label: '찬양 리스트 관리', color: '#8b7355' },
  ];

  // 데이터베이스 마지막 업데이트 시간 가져오기
  useEffect(() => {
    const fetchLastUpdated = async () => {
      setIsLoading(true);
      try {
        const result = await getDatabaseLastUpdated();
        if (result.success) {
          setLastUpdated(result.lastUpdated);
        } else {
          console.warn('마지막 업데이트 날짜를 가져올 수 없습니다:', result.error);
        }
      } catch (error) {
        console.error('마지막 업데이트 날짜 가져오기 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastUpdated();
  }, [songs, worshipLists]); // songs나 worshipLists가 변경될 때마다 업데이트

  const handleDatabaseBackup = async () => {
    try {
      const result = await createDatabaseBackup(songs, worshipLists, fileExistenceMap);
      
      if (result.success) {
        setDialog({
          isVisible: true,
          type: 'success',
          message: result.message
        });
      } else {
        setDialog({
          isVisible: true,
          type: 'error',
          message: `데이터베이스 백업 생성에 실패했습니다:\n\n${result.error}`
        });
      }
    } catch (error) {
      console.error('데이터베이스 백업 생성 오류:', error);
      setDialog({
        isVisible: true,
        type: 'error',
        message: `데이터베이스 백업 생성 중 오류가 발생했습니다:\n\n${error.message}`
      });
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
        console.log('백업 파일 복원 시작:', file.name, '크기:', file.size);
        
        // OneDrive 파일인지 확인하고 안내
        if (file.webkitRelativePath && file.webkitRelativePath.includes('OneDrive')) {
          console.log('OneDrive 파일 감지:', file.webkitRelativePath);
          setDialog({
            isVisible: true,
            type: 'info',
            message: `OneDrive 파일이 감지되었습니다.\n\n파일이 클라우드에만 있을 수 있습니다. 복원을 시도하지만 실패할 경우 다음 방법을 사용하세요:\n\n1. OneDrive에서 파일을 "항상 이 기기에서 사용 가능"으로 설정\n2. 파일을 로컬 폴더로 복사한 후 다시 선택\n3. OneDrive 동기화 상태 확인`
          });
        }
        
        // Electron API를 사용할 수 있는 경우 더 안정적인 방법 사용
        if (window.electronAPI && window.electronAPI.readFile) {
          try {
            console.log('Electron API를 사용하여 파일 읽기 시도');
            
            // 파일 경로를 OneDrive 경로로 변환 시도
            let filePath = file.path || file.name;
            
            // OneDrive 경로인 경우 직접 경로 사용
            if (filePath.includes('OneDrive') || filePath.includes('CloudStorage')) {
              console.log('OneDrive 파일 경로 사용:', filePath);
            } else {
              // 상대 경로인 경우 OneDrive 경로로 변환
              const oneDrivePath = await window.electronAPI.getOneDrivePath();
              if (oneDrivePath) {
                filePath = `${oneDrivePath}/WorshipNote_Data/Backups/${file.name}`;
                console.log('OneDrive 백업 경로로 변환:', filePath);
              }
            }
            
            const fileResult = await window.electronAPI.readFile(filePath);
            
            if (fileResult && fileResult.success && fileResult.data) {
              let jsonString;
              if (fileResult.data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(fileResult.data);
                jsonString = new TextDecoder('utf-8').decode(uint8Array);
              } else if (typeof fileResult.data === 'string') {
                jsonString = fileResult.data;
              } else {
                throw new Error('지원하지 않는 파일 데이터 형식');
              }
              
              console.log('Electron API로 파일 읽기 성공, 크기:', jsonString.length);
              await processBackupData(jsonString);
              return;
            }
          } catch (electronError) {
            console.warn('Electron API 파일 읽기 실패, FileReader로 대체:', electronError);
          }
        }
        
        // FileReader를 사용한 파일 읽기 (fallback)
        console.log('FileReader를 사용하여 파일 읽기 시도');
        
        // 파일을 직접 읽어서 처리 (여러 방법 시도)
        const fileContent = await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 3;
          
          const tryReadFile = (useArrayBuffer = false) => {
            attempts++;
            console.log(`파일 읽기 시도 ${attempts}/${maxAttempts} (${useArrayBuffer ? 'ArrayBuffer' : 'Text'}):`, file.name);
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
              if (e.target.result) {
                console.log('파일 읽기 성공, 크기:', e.target.result.length);
                
                if (useArrayBuffer) {
                  // ArrayBuffer를 문자열로 변환
                  try {
                    const uint8Array = new Uint8Array(e.target.result);
                    const textDecoder = new TextDecoder('utf-8');
                    const textContent = textDecoder.decode(uint8Array);
                    resolve(textContent);
                  } catch (decodeError) {
                    console.error('ArrayBuffer 디코딩 오류:', decodeError);
                    if (attempts < maxAttempts) {
                      console.log('ArrayBuffer 디코딩 실패, 텍스트로 재시도...');
                      setTimeout(() => tryReadFile(false), 1000);
                    } else {
                      reject(new Error('파일 디코딩에 실패했습니다.'));
                    }
                  }
                } else {
                  resolve(e.target.result);
                }
              } else {
                if (attempts < maxAttempts) {
                  console.log('파일 읽기 결과가 비어있음, 재시도...');
                  setTimeout(() => tryReadFile(!useArrayBuffer), 1000);
                } else {
                  reject(new Error('파일을 읽을 수 없습니다.'));
                }
              }
            };
            
            reader.onerror = (e) => {
              console.error(`FileReader 오류 (시도 ${attempts}):`, e);
              if (attempts < maxAttempts) {
                console.log('파일 읽기 실패, 다른 방법으로 재시도...');
                setTimeout(() => tryReadFile(!useArrayBuffer), 1000);
              } else {
                reject(new Error(`파일 읽기 중 오류가 발생했습니다: ${e.target.error?.message || '알 수 없는 오류'}`));
              }
            };
            
            reader.onabort = (e) => {
              console.error(`FileReader 중단 (시도 ${attempts}):`, e);
              if (attempts < maxAttempts) {
                console.log('파일 읽기 중단, 다른 방법으로 재시도...');
                setTimeout(() => tryReadFile(!useArrayBuffer), 1000);
              } else {
                reject(new Error('파일 읽기가 중단되었습니다.'));
              }
            };
            
            // 파일 크기 확인
            if (file.size === 0) {
              reject(new Error('파일이 비어있습니다.'));
              return;
            }
            
            if (file.size > 100 * 1024 * 1024) { // 100MB 제한
              reject(new Error('파일이 너무 큽니다. (100MB 제한)'));
              return;
            }
            
            // 파일 읽기 시작
            try {
              if (useArrayBuffer) {
                reader.readAsArrayBuffer(file);
              } else {
                reader.readAsText(file, 'UTF-8');
              }
            } catch (readError) {
              console.error('FileReader 시작 오류:', readError);
              if (attempts < maxAttempts) {
                setTimeout(() => tryReadFile(!useArrayBuffer), 1000);
              } else {
                reject(new Error(`파일 읽기 시작 실패: ${readError.message}`));
              }
            }
          };
          
          // 먼저 텍스트로 읽기 시도
          tryReadFile(false);
        });

        console.log('파일 내용 읽기 완료, 크기:', fileContent.length);
        await processBackupData(fileContent);
      } catch (error) {
        console.error('데이터베이스 복원 오류:', error);
        
        let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
        
        // OneDrive 파일 관련 오류인 경우 특별한 안내 제공
        if (errorMessage.includes('permission') || errorMessage.includes('권한')) {
          errorMessage = `OneDrive 파일 읽기 권한 오류가 발생했습니다.\n\n해결 방법:\n1. OneDrive에서 파일을 로컬로 다운로드하세요\n2. 파일을 다른 위치로 복사한 후 다시 시도하세요\n3. OneDrive 동기화 상태를 확인하세요\n\n원본 오류: ${errorMessage}`;
        } else if (errorMessage.includes('could not be read')) {
          errorMessage = `파일을 읽을 수 없습니다.\n\n가능한 원인:\n1. 파일이 OneDrive 클라우드에만 있고 로컬에 동기화되지 않음\n2. 파일이 다른 프로그램에서 사용 중\n3. 파일 권한 문제\n\n해결 방법:\n1. OneDrive에서 파일을 "항상 이 기기에서 사용 가능"으로 설정\n2. 파일을 로컬 폴더로 복사\n\n원본 오류: ${errorMessage}`;
        }
        
        setDialog({
          isVisible: true,
          type: 'error',
          message: `데이터베이스 복원에 실패했습니다:\n\n${errorMessage}`
        });
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
        
        {/* 데이터베이스 업데이트 정보 */}
        <div className="database-info">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="loading-spinner"></div>
              <span>로딩 중...</span>
            </div>
          ) : (
            <div className="database-times">
              {/* 데이터베이스 업데이트 시간 */}
              <div className="time-info">
                <Clock className="clock-icon" />
                <div className="time-text">
                  <div className="time-label">Database</div>
                  <div className="time-datetime">
                    <div className="time-date">
                      {lastUpdated ? lastUpdated.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) : '--'}
                    </div>
                    <div className="time-time">
                      {lastUpdated ? lastUpdated.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }) : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
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
      
      <GhibliDialog
        isVisible={dialog.isVisible}
        type={dialog.type}
        message={dialog.message}
        onClose={() => setDialog({ isVisible: false, type: 'success', message: '' })}
      />
    </div>
  );
};

export default Sidebar;
