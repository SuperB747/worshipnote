// 데이터 파일 관리 유틸리티
const DATA_FILE_PATH = '/data.json';

// 엑셀 파일 읽기 (Node.js 환경에서만 사용)
let XLSX;
if (typeof window === 'undefined') {
  // Node.js 환경에서만 xlsx 모듈 로드
  try {
    XLSX = require('xlsx');
  } catch (error) {
    console.warn('xlsx 모듈을 로드할 수 없습니다:', error);
  }
}

export const saveToStorage = (key, data) => {
  try {
    // 현재 데이터 로드
    const currentData = loadFromStorage('songs', { songs: [], worshipLists: {} });
    
    // 데이터 업데이트
    if (key === 'songs') {
      currentData.songs = data;
    } else if (key === 'worshipLists') {
      currentData.worshipLists = data;
    }
    
    // JSON 파일로 저장 (실제로는 localStorage에 저장)
    localStorage.setItem('worshipnote_data', JSON.stringify(currentData));
    return true;
  } catch (error) {
    console.error('Failed to save data:', error);
    return false;
  }
};

export const loadFromStorage = (key, defaultValue = null) => {
  try {
    // 먼저 localStorage에서 확인
    const localData = localStorage.getItem('worshipnote_data');
    if (localData) {
      const parsedData = JSON.parse(localData);
      if (key === 'songs') {
        return parsedData.songs || defaultValue;
      } else if (key === 'worshipLists') {
        return parsedData.worshipLists || defaultValue;
      }
      return parsedData;
    }
    
    // localStorage에 데이터가 없으면 기본값 반환
    return defaultValue;
  } catch (error) {
    console.error('Failed to load data:', error);
    return defaultValue;
  }
};

export const clearStorage = (key) => {
  try {
    if (key === 'songs') {
      const currentData = loadFromStorage('worshipLists', {});
      localStorage.setItem('worshipnote_data', JSON.stringify({ songs: [], worshipLists: currentData }));
    } else if (key === 'worshipLists') {
      const currentData = loadFromStorage('songs', []);
      localStorage.setItem('worshipnote_data', JSON.stringify({ songs: currentData, worshipLists: {} }));
    } else {
      localStorage.removeItem('worshipnote_data');
    }
    return true;
  } catch (error) {
    console.error('Failed to clear storage:', error);
    return false;
  }
};

// 악보 데이터 관리
export const saveSongs = async (songs) => {
  try {
    // localStorage에 저장
    const success = saveToStorage('songs', songs);
    
    // OneDrive에도 저장
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
            // 디렉토리가 이미 존재하는 경우 무시
            if (!dirError.message.includes('already exists')) {
              console.warn('디렉토리 생성 실패:', dirError);
            }
          }
          
          const songsData = {
            songs,
            lastUpdated: new Date().toISOString()
          };
          
          const filePath = `${databaseDirPath}/songs.json`;
          const jsonData = JSON.stringify(songsData, null, 2);
          
          await window.electronAPI.writeFile(filePath, jsonData);
        }
      } catch (oneDriveError) {
        console.error('OneDrive 저장 실패:', oneDriveError);
        // OneDrive 저장 실패해도 localStorage는 성공했으므로 계속 진행
      }
    }
    
    return success;
  } catch (error) {
    console.error('악보 데이터 저장 실패:', error);
    return false;
  }
};

export const loadSongs = async () => {
  try {
    // 먼저 OneDrive에서 로드 시도
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const filePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
          const fileData = await window.electronAPI.readFile(filePath);
          
          if (fileData) {
            const songsData = JSON.parse(fileData);
            
            // localStorage에도 저장 (동기화)
            saveToStorage('songs', songsData.songs);
            
            return songsData.songs || [];
          } else {
          }
        }
      } catch (oneDriveError) {
      }
    }
    
    // OneDrive에서 로드 실패하면 localStorage에서 로드
    const localSongs = loadFromStorage('songs', []);
    
    // 데이터가 없으면 샘플 데이터 생성
    if (localSongs.length === 0) {
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
      saveToStorage('songs', sampleSongs);
      
      return sampleSongs;
    }
    
    return localSongs;
  } catch (error) {
    console.error('악보 데이터 로드 실패:', error);
    return [];
  }
};

// 찬양 리스트 데이터 관리
export const saveWorshipLists = async (worshipLists) => {
  try {
    // localStorage에 저장
    const success = saveToStorage('worshipLists', worshipLists);
    
    // OneDrive에도 저장
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
            // 디렉토리가 이미 존재하는 경우 무시
            if (!dirError.message.includes('already exists')) {
              console.warn('디렉토리 생성 실패:', dirError);
            }
          }
          
          const worshipListsData = {
            worshipLists,
            lastUpdated: new Date().toISOString()
          };
          
          const filePath = `${databaseDirPath}/worship_lists.json`;
          const jsonData = JSON.stringify(worshipListsData, null, 2);
          
          await window.electronAPI.writeFile(filePath, jsonData);
        }
      } catch (oneDriveError) {
        console.error('OneDrive 저장 실패:', oneDriveError);
        // OneDrive 저장 실패해도 localStorage는 성공했으므로 계속 진행
      }
    }
    
    return success;
  } catch (error) {
    console.error('찬양 리스트 저장 실패:', error);
    return false;
  }
};

export const loadWorshipLists = async () => {
  try {
    // 먼저 OneDrive에서 로드 시도
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const filePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
          const fileData = await window.electronAPI.readFile(filePath);
          
          if (fileData) {
            const worshipListsData = JSON.parse(fileData);
            
            // localStorage에도 저장 (동기화)
            saveToStorage('worshipLists', worshipListsData.worshipLists);
            
            return worshipListsData.worshipLists || {};
          } else {
          }
        }
      } catch (oneDriveError) {
      }
    }
    
    // OneDrive에서 로드 실패하면 localStorage에서 로드
    const localWorshipLists = loadFromStorage('worshipLists', {});
    return localWorshipLists;
  } catch (error) {
    console.error('찬양 리스트 로드 실패:', error);
    return {};
  }
};

// 데이터 초기화
export const initializeData = async () => {
  const songs = await loadSongs();
  const worshipLists = await loadWorshipLists();
  
  return {
    songs,
    worshipLists
  };
};

// 찬양 리스트 백업 생성
export const createWorshipListsBackup = async () => {
  try {
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API가 사용할 수 없습니다. 데스크톱 앱을 실행해주세요.' };
    }
    
    if (!window.electronAPI.writeFile) {
      return { success: false, error: 'writeFile API가 사용할 수 없습니다.' };
    }
    
    if (!window.electronAPI.getOneDrivePath) {
      return { success: false, error: 'getOneDrivePath API가 사용할 수 없습니다.' };
    }
    
    const oneDrivePath = await window.electronAPI.getOneDrivePath();
    if (!oneDrivePath) {
      return { success: false, error: 'OneDrive 경로를 찾을 수 없습니다.' };
    }
    
    const dataDirPath = `${oneDrivePath}/WorshipNote_Data`;
    
    // 백업 디렉토리 생성
    const backupDirPath = `${dataDirPath}/Backups`;
    try {
      if (window.electronAPI.createDirectory) {
        const result = await window.electronAPI.createDirectory(backupDirPath);
        if (!result.success) {
          console.warn('백업 디렉토리 생성 실패:', result.error);
        }
      } else {
        // createDirectory가 없으면 빈 파일로 디렉토리 생성 시도
        await window.electronAPI.writeFile(`${backupDirPath}/.gitkeep`, '');
      }
    } catch (dirError) {
      console.warn('백업 디렉토리 생성 시도:', dirError);
      // 디렉토리 생성 실패해도 계속 진행
    }
    
    // 현재 찬양 리스트 로드
    const worshipLists = await loadWorshipLists();
    
    // 백업 파일명 (타임스탬프 포함)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `worship_lists_backup_${timestamp}.json`;
    const backupFilePath = `${backupDirPath}/${backupFileName}`;
    
    // 백업 데이터 생성
    const backupData = {
      worshipLists,
      backupDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const jsonData = JSON.stringify(backupData, null, 2);
    const writeResult = await window.electronAPI.writeFile(backupFilePath, jsonData);
    if (!writeResult.success) {
      throw new Error(`파일 쓰기 실패: ${writeResult.error}`);
    }
    
    return { 
      success: true, 
      filePath: backupFilePath,
      message: '백업이 OneDrive에 저장되었습니다.'
    };
  } catch (error) {
    console.error('백업 생성 실패:', error);
    return { success: false, error: `백업 생성 중 오류가 발생했습니다: ${error.message}` };
  }
};

// 통합 데이터베이스 백업 생성 (찬양 리스트 + 악보 정보)
export const createDatabaseBackup = async (currentSongs = null, currentWorshipLists = null, fileExistenceMap = {}) => {
  try {
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API가 사용할 수 없습니다. 데스크톱 앱을 실행해주세요.' };
    }
    
    if (!window.electronAPI.writeFile) {
      return { success: false, error: 'writeFile API가 사용할 수 없습니다.' };
    }
    
    if (!window.electronAPI.getOneDrivePath) {
      return { success: false, error: 'getOneDrivePath API가 사용할 수 없습니다.' };
    }
    
    const oneDrivePath = await window.electronAPI.getOneDrivePath();
    if (!oneDrivePath) {
      return { success: false, error: 'OneDrive 경로를 찾을 수 없습니다.' };
    }
    
    const dataDirPath = `${oneDrivePath}/WorshipNote_Data`;
    
    // 백업 디렉토리 생성
    const backupDirPath = `${dataDirPath}/Backups`;
    try {
      if (window.electronAPI.createDirectory) {
        const result = await window.electronAPI.createDirectory(backupDirPath);
        if (!result.success) {
          console.warn('백업 디렉토리 생성 실패:', result.error);
        }
      } else {
        // createDirectory가 없으면 빈 파일로 디렉토리 생성 시도
        await window.electronAPI.writeFile(`${backupDirPath}/.gitkeep`, '');
      }
    } catch (dirError) {
      console.warn('백업 디렉토리 생성 시도:', dirError);
      // 디렉토리 생성 실패해도 계속 진행
    }
    
    // 현재 데이터베이스 전체 로드
    // currentSongs, currentWorshipLists가 제공되면 사용하고, 아니면 OneDrive에서 로드
    const songs = currentSongs || await loadSongs();
    const worshipLists = currentWorshipLists || await loadWorshipLists();
    
    
    // 통합 데이터베이스 파일명 (타임스탬프 포함)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `worshipnote_database_${timestamp}.json`;
    const backupFilePath = `${backupDirPath}/${backupFileName}`;
    
    // 통합 데이터베이스 생성 (찬양 리스트 + 악보 정보)
    const databaseData = {
      // 메타데이터
      version: '2.0',
      type: 'worshipnote_database',
      backupDate: new Date().toISOString(),
      description: 'WorshipNote 통합 데이터베이스 (찬양 리스트 + 악보 정보)',
      
      // 실제 데이터
      songs: songs,
      worshipLists: worshipLists,
      
      // 통계 정보
      stats: {
        totalSongs: songs.length,
        totalWorshipLists: Object.keys(worshipLists).length,
        totalWorshipListSongs: Object.values(worshipLists).reduce((total, list) => total + list.length, 0),
        backupSize: 0 // 파일 크기는 저장 후 계산
      },
      
      // 데이터 구조 정보
      dataStructure: {
        songs: {
          description: '악보 정보 배열',
          fields: ['id', 'title', 'code', 'tempo', 'fileName', 'filePath', 'firstLyrics', 'createdAt', 'updatedAt']
        },
        worshipLists: {
          description: '날짜별 찬양 리스트 객체',
          keyFormat: 'YYYY-MM-DD',
          valueFormat: '곡 정보 배열'
        }
      }
    };
    
    // JSON 생성 시 오류 처리
    let jsonData;
    try {
      jsonData = JSON.stringify(databaseData, null, 2);
    } catch (stringifyError) {
      console.error('JSON 생성 오류:', stringifyError);
      return { success: false, error: `데이터를 JSON으로 변환할 수 없습니다: ${stringifyError.message}` };
    }
    
    // JSON 데이터 검증
    if (!jsonData || jsonData.length === 0) {
      return { success: false, error: '생성된 JSON 데이터가 비어있습니다.' };
    }
    
    
    const writeResult = await window.electronAPI.writeFile(backupFilePath, jsonData);
    if (!writeResult.success) {
      throw new Error(`파일 쓰기 실패: ${writeResult.error}`);
    }
    
    // 파일 크기 계산
    const fileSize = new Blob([jsonData]).size;
    databaseData.stats.backupSize = fileSize;
    
    
    // 악보가 없는 찬양 개수 계산 (악보 검색과 동일한 로직 사용)
    const songsWithoutMusicSheet = songs.filter(song => {
      // fileName이 없으면 악보 없음
      if (!song.fileName || song.fileName.trim() === '') {
        return true;
      }
      
      // fileExistenceMap에서 실제 파일 존재 여부 확인
      return fileExistenceMap[song.id] !== true;
    }).length;
    
    return { 
      success: true, 
      filePath: backupFilePath,
      message: `통합 데이터베이스 백업이 생성되었습니다!\n\n📊 데이터 현황:\n• 찬양 갯수: ${songs.length}개\n• 악보 없는 찬양: ${songsWithoutMusicSheet}개\n• 찬양 리스트: ${Object.keys(worshipLists).length}개\n• 파일 크기: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      stats: databaseData.stats,
      fileName: backupFileName
    };
  } catch (error) {
    console.error('통합 데이터베이스 백업 생성 실패:', error);
    return { success: false, error: `백업 생성 중 오류가 발생했습니다: ${error.message}` };
  }
};

// 통합 데이터베이스 복원
export const restoreDatabaseFromBackup = async (backupFilePath, setSongs, setWorshipLists) => {
  try {
    if (!window.electronAPI || !window.electronAPI.readFile) {
      return { success: false, error: 'Electron API가 사용할 수 없습니다.' };
    }
    
    const fileData = await window.electronAPI.readFile(backupFilePath);
    
    // 파일 데이터 검증
    if (!fileData) {
      return { success: false, error: '백업 파일을 읽을 수 없습니다.' };
    }
    
    // JSON 파일은 이미 문자열로 반환됨
    const jsonString = fileData;
    
    // JSON 파싱 시도
    let backupData;
    try {
      backupData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('파일 내용 (처음 200자):', jsonString.substring(0, 200));
      return { 
        success: false, 
        error: `백업 파일 형식이 올바르지 않습니다.\n오류: ${parseError.message}\n파일 내용: ${jsonString.substring(0, 100)}...` 
      };
    }
    
    // 백업 파일 형식 확인 (기존 형식과 새 형식 모두 지원)
    const isOldFormat = backupData.type === 'database';
    const isNewFormat = backupData.type === 'worshipnote_database';
    
    if (!isOldFormat && !isNewFormat) {
      return { success: false, error: '올바른 WorshipNote 백업 파일이 아닙니다.' };
    }
    
    if (!backupData.songs || !backupData.worshipLists) {
      return { success: false, error: '백업 파일에 필요한 데이터가 없습니다.' };
    }
    
    // 데이터 복원
    const songs = backupData.songs || [];
    const worshipLists = backupData.worshipLists || {};
    
    console.log('복원할 데이터:', {
      songsCount: songs.length,
      worshipListsCount: Object.keys(worshipLists).length,
      worshipListsKeys: Object.keys(worshipLists).slice(0, 5) // 처음 5개 키만 표시
    });
    
    // localStorage에 저장
    saveToStorage('songs', songs);
    saveToStorage('worshipLists', worshipLists);
    
    // OneDrive에도 저장
    console.log('OneDrive에 저장 시작...');
    const songsResult = await saveSongs(songs);
    const worshipListsResult = await saveWorshipLists(worshipLists);
    console.log('OneDrive 저장 결과:', { songsResult, worshipListsResult });
    
    // React 상태 업데이트
    if (setSongs) setSongs(songs);
    if (setWorshipLists) setWorshipLists(worshipLists);
    
    
    const stats = {
      totalSongs: songs.length,
      totalWorshipLists: Object.keys(worshipLists).length,
      totalWorshipListSongs: Object.values(worshipLists).reduce((total, list) => total + list.length, 0)
    };
    
    return { 
      success: true, 
      message: `통합 데이터베이스가 복원되었습니다!\n\n📊 복원된 데이터:\n• 악보: ${songs.length}개\n• 찬양 리스트: ${Object.keys(worshipLists).length}개 날짜\n• 총 찬양 리스트 곡: ${stats.totalWorshipListSongs}개\n• 백업 날짜: ${backupData.backupDate || '알 수 없음'}`,
      stats: stats,
      backupInfo: {
        version: backupData.version || '1.0',
        type: backupData.type,
        backupDate: backupData.backupDate,
        description: backupData.description
      }
    };
  } catch (error) {
    console.error('통합 데이터베이스 복원 실패:', error);
    return { success: false, error: `복원 중 오류가 발생했습니다: ${error.message}` };
  }
};

// 백업 파일 목록 가져오기
export const getBackupFiles = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.getOneDrivePath) {
      return { success: false, error: 'OneDrive API가 사용할 수 없습니다.' };
    }
    
    const oneDrivePath = await window.electronAPI.getOneDrivePath();
    const backupDirPath = `${oneDrivePath}/Backups`;
    
    // 백업 디렉토리의 파일 목록을 가져오는 API가 필요합니다
    // 일단 기본 경로를 반환
    return { 
      success: true, 
      backupDirPath,
      message: '백업 파일을 선택해주세요.'
    };
  } catch (error) {
    console.error('백업 파일 목록 가져오기 실패:', error);
    return { success: false, error: error.message };
  }
};

// 찬양 리스트 복원 (기존 함수 유지)
export const restoreWorshipListsFromBackup = async (backupFilePath) => {
  try {
    if (window.electronAPI && window.electronAPI.readFile) {
      const fileData = await window.electronAPI.readFile(backupFilePath);
      const backupData = JSON.parse(fileData);
      
      if (backupData.worshipLists) {
        await saveWorshipLists(backupData.worshipLists);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid backup file format' };
      }
    }
    return { success: false, error: 'OneDrive API not available' };
  } catch (error) {
    console.error('복원 실패:', error);
    return { success: false, error: error.message };
  }
};

