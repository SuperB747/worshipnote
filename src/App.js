import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AddSong from './pages/AddSong';
import SearchSongs from './pages/SearchSongs';
import WorshipList from './pages/WorshipList';
import SongPreview from './components/SongPreview';
import Snackbar from './components/Snackbar';
import SyncAnimation from './components/SyncAnimation';
import { useSnackbar } from './hooks/useSnackbar';
import { initializeData, saveSongs, saveWorshipLists, compareDatabaseVersions, syncFromOneDrive } from './utils/storage';
import './App.css';

function App() {
  const [selectedSong, setSelectedSong] = useState(null);
  const [songs, setSongs] = useState([]);
  const [worshipLists, setWorshipLists] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const { snackbar, showSuccess, showError, showLoading, hideSnackbar } = useSnackbar();
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [lastSavedSongs, setLastSavedSongs] = useState(null);
  const [lastSavedWorshipLists, setLastSavedWorshipLists] = useState(null);
  const [fileExistenceMap, setFileExistenceMap] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // 실제 파일 존재 여부를 확인하는 함수
  const checkFileExists = async (fileName) => {
    if (!fileName || !window.electronAPI || !window.electronAPI.readFile) {
      return false;
    }
    
    try {
      // Music_Sheets 경로를 가져와서 파일 경로 구성
      const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
      const fullPath = `${musicSheetsPath}/${fileName}`;
      
      // 파일 읽기 시도 (파일이 없으면 null 반환)
      const fileData = await window.electronAPI.readFile(fullPath);
      return fileData !== null;
    } catch (error) {
      console.error('File existence check failed:', error);
      return false;
    }
  };

  // 앱 초기화 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // Electron 환경에서 electronAPI가 준비될 때까지 기다림
        if (window.electronAPI) {
          // 먼저 OneDrive와 로컬 데이터베이스 버전 비교
          const versionComparison = await compareDatabaseVersions();
          
          if (versionComparison.success && versionComparison.needsSync) {
            console.log('OneDrive 데이터베이스가 더 최신입니다. 동기화를 시작합니다...');
            console.log('동기화 상세 정보:', versionComparison.details);
            setIsSyncing(true);
            
            let syncMessage = 'OneDrive에서 최신 데이터를 동기화하는 중...';
            if (versionComparison.reason === 'onedrive_songs_newer') {
              syncMessage = 'OneDrive의 찬양 데이터가 더 최신입니다. 동기화 중...';
            } else if (versionComparison.reason === 'onedrive_worship_lists_newer') {
              syncMessage = 'OneDrive의 찬양 리스트가 더 최신입니다. 동기화 중...';
            } else if (versionComparison.reason === 'onedrive_both_newer') {
              syncMessage = 'OneDrive의 모든 데이터가 더 최신입니다. 동기화 중...';
            }
            setSyncMessage(syncMessage);
            
            const syncResult = await syncFromOneDrive();
            
            if (syncResult.success) {
              setSongs(syncResult.songs);
              setWorshipLists(syncResult.worshipLists);
              // 마지막 저장된 데이터로 설정 (초기 저장 방지)
              setLastSavedSongs(JSON.parse(JSON.stringify(syncResult.songs)));
              setLastSavedWorshipLists(JSON.parse(JSON.stringify(syncResult.worshipLists)));
              
              // 동기화 완료 애니메이션을 잠시 보여준 후 숨김
              setSyncMessage('동기화가 완료되었습니다!');
              setTimeout(() => {
                setIsSyncing(false);
                showSuccess(syncResult.message);
              }, 1500);
            } else {
              console.warn('OneDrive 동기화 실패, 로컬 데이터를 사용합니다:', syncResult.error);
              setSyncMessage('동기화에 실패했습니다. 로컬 데이터를 사용합니다.');
              setTimeout(() => {
                setIsSyncing(false);
                showError(`OneDrive 동기화 실패: ${syncResult.error}`);
              }, 1500);
              
              // 동기화 실패 시 로컬 데이터 로드
              const { songs, worshipLists } = await initializeData();
              setSongs(songs);
              setWorshipLists(worshipLists);
              setLastSavedSongs(JSON.parse(JSON.stringify(songs)));
              setLastSavedWorshipLists(JSON.parse(JSON.stringify(worshipLists)));
            }
          } else {
            // 동기화가 필요하지 않은 경우 기존 방식으로 로드
            const { songs, worshipLists } = await initializeData();
            
            setSongs(songs);
            setWorshipLists(worshipLists);
            // 마지막 저장된 데이터로 설정 (초기 저장 방지)
            setLastSavedSongs(JSON.parse(JSON.stringify(songs)));
            setLastSavedWorshipLists(JSON.parse(JSON.stringify(worshipLists)));
          }
        } else {
          // 웹 환경이거나 Electron API가 아직 준비되지 않은 경우
          
          // localStorage에서 직접 데이터 로드
          const localData = localStorage.getItem('worshipnote_data');
          if (localData) {
            const parsedData = JSON.parse(localData);
            const songs = parsedData.songs || [];
            const worshipLists = parsedData.worshipLists || {};
            
            setSongs(songs);
            setWorshipLists(worshipLists);
            // 마지막 저장된 데이터로 설정 (초기 저장 방지)
            setLastSavedSongs(JSON.parse(JSON.stringify(songs)));
            setLastSavedWorshipLists(JSON.parse(JSON.stringify(worshipLists)));
          } else {
            // localStorage에도 데이터가 없으면 샘플 데이터 생성
            const sampleSongs = [
              {
                id: 1,
                title: '주님의 마음',
                firstLyrics: '주님의 마음은 평화의 마음',
                key: 'C',
                tempo: 'Medium',
                fileName: 'sample1.pdf',
                filePath: '/sample/path1.pdf'
              },
              {
                id: 2,
                title: '예수님은 우리의 친구',
                firstLyrics: '예수님은 우리의 친구',
                key: 'D',
                tempo: 'Fast',
                fileName: 'sample2.pdf',
                filePath: '/sample/path2.pdf'
              },
              {
                id: 3,
                title: '주님을 사랑하는 이들아',
                firstLyrics: '주님을 사랑하는 이들아',
                key: 'E',
                tempo: 'Slow',
                fileName: 'sample3.pdf',
                filePath: '/sample/path3.pdf'
              },
              {
                id: 4,
                title: '하나님의 사랑',
                firstLyrics: '하나님의 사랑은 넓고 깊어',
                key: 'F',
                tempo: 'Medium',
                fileName: 'sample4.pdf',
                filePath: '/sample/path4.pdf'
              },
              {
                id: 5,
                title: '예수님을 믿으니',
                firstLyrics: '예수님을 믿으니 평안해져',
                key: 'G',
                tempo: 'Fast',
                fileName: 'sample5.pdf',
                filePath: '/sample/path5.pdf'
              }
            ];
            
            // 샘플 데이터를 localStorage에 저장
            localStorage.setItem('worshipnote_data', JSON.stringify({
              songs: sampleSongs,
              worshipLists: {}
            }));
            
            setSongs(sampleSongs);
            setWorshipLists({});
            // 마지막 저장된 데이터로 설정 (초기 저장 방지)
            setLastSavedSongs(JSON.parse(JSON.stringify(sampleSongs)));
            setLastSavedWorshipLists(JSON.parse(JSON.stringify({})));
          }
        }
        
        setIsLoaded(true);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setSongs([]);
        setWorshipLists({});
        setIsLoaded(true);
      }
    };
    
    // Electron API가 준비될 때까지 잠시 기다림
    const timer = setTimeout(() => {
      loadData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // songs가 로드된 후 파일 존재 여부 확인
  useEffect(() => {
    const checkAllFiles = async () => {
      if (songs.length === 0 || !window.electronAPI) return;
      
      const existenceMap = {};
      
      for (const song of songs) {
        if (song.fileName && song.fileName.trim() !== '') {
          const exists = await checkFileExists(song.fileName);
          existenceMap[song.id] = exists;
        } else {
          existenceMap[song.id] = false;
        }
      }
      
      setFileExistenceMap(existenceMap);
    };

    checkAllFiles();
  }, [songs]);

  // songs 변경 시 저장 및 선택된 곡 확인 (실제 변경 시에만 저장)
  useEffect(() => {
    if (isLoaded && lastSavedSongs !== null) {
      // 데이터가 실제로 변경되었는지 확인
      const hasChanged = JSON.stringify(songs) !== JSON.stringify(lastSavedSongs);
      
      if (hasChanged) {
        // 기존 타이머가 있으면 취소
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // 1초 후에 저장 실행
        const timeout = setTimeout(async () => {
          try {
            showLoading('변경사항 저장 중...', 0);
            await saveSongs(songs);
            setLastSavedSongs(JSON.parse(JSON.stringify(songs))); // 깊은 복사
            hideSnackbar();
            showSuccess('변경사항이 저장되었습니다');
          } catch (error) {
            console.error('악보 데이터 저장 실패:', error);
            hideSnackbar();
            showError('변경사항 저장에 실패했습니다');
          }
        }, 1000);

        setSaveTimeout(timeout);
      }
      
      // 선택된 곡이 삭제되었는지 확인 (songs 배열에서만 확인)
      if (selectedSong && !songs.find(song => song.id === selectedSong.id)) {
        // 찬양 리스트에서 선택한 곡인지 확인
        const isInWorshipList = Object.values(worshipLists).some(list => 
          list.some(song => song.id === selectedSong.id)
        );
        
        // songs 배열에도 없고 찬양 리스트에도 없으면 null로 설정
        if (!isInWorshipList) {
          setSelectedSong(null);
        }
      }
    }
  }, [songs, isLoaded, selectedSong, worshipLists]);

  // worshipLists 변경 시 저장 (실제 변경 시에만 저장)
  useEffect(() => {
    if (isLoaded && lastSavedWorshipLists !== null) {
      // 데이터가 실제로 변경되었는지 확인
      const hasChanged = JSON.stringify(worshipLists) !== JSON.stringify(lastSavedWorshipLists);
      
      if (hasChanged) {
        // 기존 타이머가 있으면 취소
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // 1초 후에 저장 실행
        const timeout = setTimeout(async () => {
          try {
            showLoading('변경사항 저장 중...', 0);
            await saveWorshipLists(worshipLists);
            setLastSavedWorshipLists(JSON.parse(JSON.stringify(worshipLists))); // 깊은 복사
            hideSnackbar();
            showSuccess('변경사항이 저장되었습니다');
          } catch (error) {
            console.error('찬양 리스트 저장 실패:', error);
            hideSnackbar();
            showError('변경사항 저장에 실패했습니다');
          }
        }, 1000);

        setSaveTimeout(timeout);
      }
    }
  }, [worshipLists, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>WorshipNote를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app">
        <Sidebar 
          songs={songs}
          worshipLists={worshipLists}
          setSongs={setSongs}
          setWorshipLists={setWorshipLists}
          fileExistenceMap={fileExistenceMap}
        />
        <div className="main-content">
          <div className="content-area">
            <Routes>
              <Route 
                path="/" 
                element={<SearchSongs songs={songs} setSongs={setSongs} selectedSong={selectedSong} setSelectedSong={setSelectedSong} fileExistenceMap={fileExistenceMap} />} 
              />
              <Route 
                path="/add" 
                element={<AddSong songs={songs} setSongs={setSongs} setSelectedSong={setSelectedSong} />} 
              />
              <Route 
                path="/worship-list" 
                element={<WorshipList songs={songs} worshipLists={worshipLists} setWorshipLists={setWorshipLists} setSelectedSong={setSelectedSong} setSongs={setSongs} />} 
              />
            </Routes>
          </div>
          <SongPreview selectedSong={selectedSong} />
        </div>
        <Snackbar 
          isVisible={snackbar.isVisible}
          type={snackbar.type}
          message={snackbar.message}
          onClose={hideSnackbar}
        />
        <SyncAnimation 
          isVisible={isSyncing}
          message={syncMessage}
        />
      </div>
    </Router>
  );
}

export default App;
