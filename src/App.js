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
import { initializeData, saveSongs, saveWorshipLists, checkFileExists } from './utils/storage';
import './App.css';

function App() {
  const [selectedSong, setSelectedSong] = useState(null);
  const [songs, setSongs] = useState([]);
  const [worshipLists, setWorshipLists] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const { snackbar, showSuccess, showError, showLoading, hideSnackbar } = useSnackbar();
  const [fileExistenceMap, setFileExistenceMap] = useState({});
  const [isFileExistenceLoaded, setIsFileExistenceLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [selectedWorshipListDate, setSelectedWorshipListDate] = useState(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

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
      return false;
    }
  };

  // 앱 초기화 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('데이터 로딩 시작...');
        // OneDrive에서 최신 데이터 로드 (동기화 로직 제거)
        const { songs, worshipLists } = await initializeData();
        
        console.log('로드된 songs:', songs.length, '개');
        console.log('로드된 worshipLists:', Object.keys(worshipLists).length, '개');
        
        setSongs(songs);
        setWorshipLists(worshipLists);
        
        console.log('데이터 설정 완료, isLoaded를 true로 설정');
        
        // 앱 시작 시 최신 찬양 리스트 날짜 설정
        if (isFirstLoad) {
          const getLatestWorshipListDate = () => {
            const dates = Object.keys(worshipLists).filter(date => 
              date !== 'lastUpdated' && worshipLists[date] && worshipLists[date].length > 0
            );
            
            if (dates.length === 0) {
              return new Date(); // 찬양 리스트가 없으면 오늘 날짜 반환
            }
            
            // 날짜를 정렬하여 가장 최근 날짜 반환 (시차 문제 해결)
            const sortedDates = dates.sort((a, b) => {
              // YYYY-MM-DD 형식의 문자열을 직접 비교하여 시차 문제 방지
              return b.localeCompare(a);
            });
            
            // 가장 최근 날짜를 Date 객체로 변환 (로컬 시간대 사용)
            const latestDateString = sortedDates[0];
            const [year, month, day] = latestDateString.split('-').map(Number);
            return new Date(year, month - 1, day); // month는 0부터 시작하므로 -1
          };
          
          const latestDate = getLatestWorshipListDate();
          setSelectedWorshipListDate(latestDate);
          setIsFirstLoad(false);
        }
        
        console.log('setIsLoaded(true) 호출');
        setIsLoaded(true);
      } catch (error) {
        console.log('데이터 로딩 에러:', error);
        setSongs([]);
        setWorshipLists({});
        console.log('에러 후 setIsLoaded(true) 호출');
        setIsLoaded(true);
      }
    };
    
    // Electron API가 준비될 때까지 잠시 기다림
    const timer = setTimeout(() => {
      loadData();
    }, 100);
    
    // 안전장치: 5초 후에도 로딩이 완료되지 않으면 강제로 완료 처리
    const safetyTimer = setTimeout(() => {
      console.log('안전장치: 5초 후 강제로 로딩 완료 처리');
      setIsLoaded(true);
    }, 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  // songs가 로드된 후 파일 존재 여부 확인
  useEffect(() => {
    const checkAllFiles = async () => {
      if (songs.length === 0 || !window.electronAPI) return;
      
      setIsFileExistenceLoaded(false);
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
      setIsFileExistenceLoaded(true);
    };

    checkAllFiles();
  }, [songs]);

  // 선택된 곡이 삭제되었는지 확인
  useEffect(() => {
    if (isLoaded && selectedSong) {
      // 선택된 곡이 삭제되었는지 확인 (songs 배열에서만 확인)
      if (!songs.find(song => song.id === selectedSong.id)) {
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
    <Router basename="/" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                element={<SearchSongs songs={songs} setSongs={setSongs} selectedSong={selectedSong} setSelectedSong={setSelectedSong} fileExistenceMap={fileExistenceMap} setFileExistenceMap={setFileExistenceMap} worshipLists={worshipLists} setWorshipLists={setWorshipLists} isFileExistenceLoaded={isFileExistenceLoaded} />} 
              />
              <Route 
                path="/add" 
                element={<AddSong songs={songs} setSongs={setSongs} setSelectedSong={setSelectedSong} />} 
              />
              <Route 
                path="/worship-list" 
                element={<WorshipList songs={songs} worshipLists={worshipLists} setWorshipLists={setWorshipLists} setSelectedSong={setSelectedSong} setSongs={setSongs} fileExistenceMap={fileExistenceMap} setFileExistenceMap={setFileExistenceMap} selectedWorshipListDate={selectedWorshipListDate} setSelectedWorshipListDate={setSelectedWorshipListDate} isFileExistenceLoaded={isFileExistenceLoaded} />} 
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
