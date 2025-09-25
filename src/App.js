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
  const [forceRender, setForceRender] = useState(0);
  const [currentPage, setCurrentPage] = useState('search'); // 'search', 'add', 'worship-list'

  // 페이지 전환 함수
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };


  // 앱 초기화 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 컴포넌트가 완전히 마운트될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // DOM이 완전히 로드될 때까지 대기
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            const checkReady = () => {
              if (document.readyState === 'complete') {
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        }
        
        // Electron API가 로드될 때까지 대기 (더 긴 시간)
        let retryCount = 0;
        const maxRetries = 100; // 10초 대기 (100ms * 100)
        
        while (!window.electronAPI && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retryCount++;
        }
        
        if (!window.electronAPI) {
          // 개발 모드에서는 Electron API 없이도 작동하도록 fallback
          setSongs([]);
          setWorshipLists({});
          setIsLoaded(true);
          return;
        }
        
        // OneDrive에서 최신 데이터 로드 (동기화 로직 제거)
        const { songs, worshipLists } = await initializeData();
        
        setSongs(songs);
        setWorshipLists(worshipLists);
        
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
        
        setIsLoaded(true);
        
        // 강제 렌더링 트리거
        setTimeout(() => {
          setForceRender(prev => prev + 1);
        }, 100);
      } catch (error) {
        setSongs([]);
        setWorshipLists({});
        setIsLoaded(true);
        
        // 강제 렌더링 트리거
        setTimeout(() => {
          setForceRender(prev => prev + 1);
        }, 100);
      }
    };
    
    // 즉시 로딩 시도
    loadData();
    
    // 안전장치: 3초 후에도 로딩이 완료되지 않으면 강제로 완료 처리
    const safetyTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 3000);
    
    return () => {
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
          try {
            // Music_Sheets 경로를 가져와서 전체 경로 구성
            const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
            const fullPath = `${musicSheetsPath}/${song.fileName}`;
            
            let exists = await checkFileExists(fullPath);
            
            // 파일이 존재하지 않으면 대안 경로들도 시도
            if (!exists) {
              // 1. filePath가 있으면 그것도 시도
              if (song.filePath && song.filePath.trim() !== '') {
                exists = await checkFileExists(song.filePath);
              }
              
              // 2. 파일명만으로 검색 시도
              if (!exists) {
                try {
                  const files = await window.electronAPI.getMusicSheetsFiles();
                  const fileNameWithoutExt = song.fileName.toLowerCase().split('.')[0];
                  const matchingFile = files.find(file => {
                    const fileWithoutExt = file.toLowerCase().split('.')[0];
                    return fileWithoutExt.includes(fileNameWithoutExt) || 
                           fileNameWithoutExt.includes(fileWithoutExt) ||
                           file.toLowerCase().includes(fileNameWithoutExt);
                  });
                  
                  if (matchingFile) {
                    const altPath = `${musicSheetsPath}/${matchingFile}`;
                    exists = await checkFileExists(altPath);
                  }
                } catch (altError) {
                  // 대안 검색 실패는 무시
                }
              }
            }
            
            existenceMap[song.id] = exists;
          } catch (error) {
            existenceMap[song.id] = false;
          }
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


  // Router 없이 직접 SearchSongs 렌더링 (테스트용)
  return (
    <div className="app">
      <Sidebar 
        songs={songs}
        worshipLists={worshipLists}
        setSongs={setSongs}
        setWorshipLists={setWorshipLists}
        fileExistenceMap={fileExistenceMap}
        onPageChange={handlePageChange}
        currentPage={currentPage}
      />
      <div className="main-content">
        <div className="content-area">
          {currentPage === 'search' && (
            <SearchSongs 
              songs={songs} 
              setSongs={setSongs} 
              selectedSong={selectedSong} 
              setSelectedSong={setSelectedSong} 
              fileExistenceMap={fileExistenceMap} 
              setFileExistenceMap={setFileExistenceMap} 
              worshipLists={worshipLists} 
              setWorshipLists={setWorshipLists} 
              isFileExistenceLoaded={isFileExistenceLoaded} 
            />
          )}
          {currentPage === 'add' && (
            <AddSong 
              songs={songs} 
              setSongs={setSongs} 
              setSelectedSong={setSelectedSong} 
            />
          )}
          {currentPage === 'worship-list' && (
            <WorshipList 
              songs={songs} 
              worshipLists={worshipLists} 
              setWorshipLists={setWorshipLists} 
              setSelectedSong={setSelectedSong} 
              setSongs={setSongs} 
              fileExistenceMap={fileExistenceMap} 
              setFileExistenceMap={setFileExistenceMap} 
              selectedWorshipListDate={selectedWorshipListDate} 
              setSelectedWorshipListDate={setSelectedWorshipListDate} 
              isFileExistenceLoaded={isFileExistenceLoaded} 
            />
          )}
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
  );
}

export default App;
