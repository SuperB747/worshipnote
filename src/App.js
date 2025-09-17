import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AddSong from './pages/AddSong';
import SearchSongs from './pages/SearchSongs';
import WorshipList from './pages/WorshipList';
import SongPreview from './components/SongPreview';
import { initializeData, saveSongs, saveWorshipLists } from './utils/storage';
import './App.css';

function App() {
  const [selectedSong, setSelectedSong] = useState(null);
  const [songs, setSongs] = useState([]);
  const [worshipLists, setWorshipLists] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // 앱 초기화 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 먼저 OneDrive에서 데이터 로드 시도
        console.log('OneDrive에서 데이터 로드 시도...');
        const { songs, worshipLists } = await initializeData();
        
        if (songs.length > 0 || Object.keys(worshipLists).length > 0) {
          // OneDrive에서 데이터를 성공적으로 로드한 경우
          console.log('OneDrive에서 로드됨 - songs:', songs.length, 'worshipLists:', Object.keys(worshipLists).length);
          setSongs(songs);
          setWorshipLists(worshipLists);
        } else {
          // OneDrive에 데이터가 없으면 JSON 파일에서 로드 시도
          console.log('OneDrive에 데이터가 없음, JSON 파일에서 로드 시도...');
          const response = await fetch('/data.json');
          if (response.ok) {
            const data = await response.json();
            const songs = data.songs || [];
            const worshipLists = data.worshipLists || {};
            
            console.log('JSON에서 로드됨 - songs:', songs.length, 'worshipLists:', Object.keys(worshipLists).length);
            
            // 잘못된 경로를 가진 데이터 정리
            const cleanedSongs = songs.filter(song => {
              if (song.filePath && (song.filePath.includes('다운로드됨:') || !song.filePath.includes('OneDrive'))) {
                console.log('Removing invalid song:', song.title, song.filePath);
                return false;
              }
              return true;
            });
            
            setSongs(cleanedSongs);
            setWorshipLists(worshipLists);
            
            // OneDrive에 저장
            await saveSongs(cleanedSongs);
            await saveWorshipLists(worshipLists);
          } else {
            // JSON 파일도 없으면 빈 상태로 시작
            console.log('데이터 파일이 없음, 빈 상태로 시작');
            setSongs([]);
            setWorshipLists({});
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
    
    loadData();
  }, []);

  // songs 변경 시 저장 및 선택된 곡 확인
  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await saveSongs(songs);
        } catch (error) {
          console.error('악보 데이터 저장 실패:', error);
        }
      };
      saveData();
      
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

  // worshipLists 변경 시 저장
  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await saveWorshipLists(worshipLists);
          console.log('찬양 리스트 저장 완료:', Object.keys(worshipLists).length, '개 날짜');
        } catch (error) {
          console.error('찬양 리스트 저장 실패:', error);
        }
      };
      saveData();
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
    <Router>
      <div className="app">
        <Sidebar />
        <div className="main-content">
          <div className="content-area">
            <Routes>
              <Route 
                path="/" 
                element={<AddSong songs={songs} setSongs={setSongs} setSelectedSong={setSelectedSong} />} 
              />
              <Route 
                path="/search" 
                element={<SearchSongs songs={songs} setSongs={setSongs} selectedSong={selectedSong} setSelectedSong={setSelectedSong} />} 
              />
              <Route 
                path="/worship-list" 
                element={<WorshipList songs={songs} worshipLists={worshipLists} setWorshipLists={setWorshipLists} setSelectedSong={setSelectedSong} setSongs={setSongs} />} 
              />
            </Routes>
          </div>
          <SongPreview selectedSong={selectedSong} />
        </div>
      </div>
    </Router>
  );
}

export default App;
