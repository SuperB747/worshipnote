// 데이터 파일 관리 유틸리티
const DATA_FILE_PATH = '/data.json';

// 엑셀 파일 읽기 (Node.js 환경에서만 사용)
let XLSX;
if (typeof window === 'undefined') {
  // Node.js 환경에서만 xlsx 모듈 로드
  try {
    XLSX = require('xlsx');
  } catch (error) {
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
    
    // 마지막 저장 시간 추가
    currentData.lastSaved = new Date().toISOString();
    
    // JSON 파일로 저장 (실제로는 localStorage에 저장)
    localStorage.setItem('worshipnote_data', JSON.stringify(currentData));
    return true;
  } catch (error) {
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
            }
          }
          
          const songsData = {
            songs,
            lastUpdated: new Date().toISOString()
          };
          
          const filePath = `${databaseDirPath}/songs.json`;
          const jsonData = JSON.stringify(songsData, null, 2);
          
          await window.electronAPI.writeFile(filePath, jsonData);
          
          // OneDrive 업로드 성공 시 시간 저장
          const currentData = loadFromStorage('songs', { songs: [], worshipLists: {} });
          currentData.lastOneDriveSync = new Date().toISOString();
          localStorage.setItem('worshipnote_data', JSON.stringify(currentData));
        }
      } catch (oneDriveError) {
        // OneDrive 저장 실패해도 localStorage는 성공했으므로 계속 진행
      }
    }
    
    return success;
  } catch (error) {
    return false;
  }
};

export const loadSongs = async () => {
  try {
    // Electron API가 없으면 localStorage에서만 로드
    if (!window.electronAPI) {
      const localData = loadFromStorage('songs', null);
      return localData || [];
    }
    
    // 먼저 localStorage에서 로드 시도 (최신 복원 데이터가 있을 수 있음)
    const localData = loadFromStorage('songs', null);
    if (localData && localData.length > 0) {
      // localStorage에 데이터가 있으면 OneDrive와 동기화 시도
      if (window.electronAPI && window.electronAPI.readFile) {
        try {
          const oneDrivePath = await window.electronAPI.getOneDrivePath();
          if (oneDrivePath) {
            const filePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
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
              
              const songsData = JSON.parse(jsonString);
              
              // OneDrive 데이터와 localStorage 데이터 비교
              const localTimestamp = localStorage.getItem('worshipnote_data') ? 
                JSON.parse(localStorage.getItem('worshipnote_data')).lastSaved : null;
              const oneDriveTimestamp = songsData.lastUpdated;
              
              // localStorage가 더 최신이면 localStorage 데이터 사용
              if (localTimestamp && oneDriveTimestamp && localTimestamp > oneDriveTimestamp) {
                return localData;
              } else {
                saveToStorage('songs', songsData.songs);
                return songsData.songs || [];
              }
            }
          }
        } catch (oneDriveError) {
          // OneDrive 동기화 실패 시 localStorage 데이터 사용
        }
      }
      
      return localData;
    }
    
    // localStorage에 데이터가 없으면 OneDrive에서 로드 시도
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const filePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
          const fileResult = await window.electronAPI.readFile(filePath);
          
          if (fileResult && fileResult.success && fileResult.data) {
            // 파일 데이터가 ArrayBuffer인 경우 문자열로 변환
            let jsonString;
            if (fileResult.data instanceof ArrayBuffer) {
              const uint8Array = new Uint8Array(fileResult.data);
              jsonString = new TextDecoder('utf-8').decode(uint8Array);
            } else if (typeof fileResult.data === 'string') {
              jsonString = fileResult.data;
            } else {
              throw new Error('지원하지 않는 파일 데이터 형식');
            }
            
            const songsData = JSON.parse(jsonString);
            // console.log('OneDrive에서 로드된 songs:', songsData.songs?.length || 0, '개');
            
            // localStorage에도 저장 (동기화)
            saveToStorage('songs', songsData.songs);
            
            return songsData.songs || [];
          }
        }
      } catch (oneDriveError) {
        // console.log('OneDrive 로드 실패:', oneDriveError.message);
        // OneDrive 로드 실패 시 public/data.json에서 로드
        try {
          // console.log('public/data.json에서 로드 시도...');
          const response = await fetch('/data.json');
          if (response.ok) {
            const data = await response.json();
            const songs = data.songs || [];
            // console.log('public/data.json에서 로드된 songs:', songs.length, '개');
            
            // localStorage에도 저장 (동기화)
            saveToStorage('songs', songs);
            
            return songs;
          }
        } catch (fetchError) {
          // console.log('public/data.json 로드 실패:', fetchError.message);
        }
      }
    } else {
      // 웹 환경에서는 public/data.json에서 로드
      try {
        const response = await fetch('/data.json');
        if (response.ok) {
          const data = await response.json();
          const songs = data.songs || [];
          
          // localStorage에도 저장 (동기화)
          saveToStorage('songs', songs);
          
          return songs;
        }
      } catch (fetchError) {
      }
    }
    
    // OneDrive/웹에서 로드 실패하면 localStorage에서 로드
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
            }
          }
          
          const worshipListsData = {
            worshipLists,
            lastUpdated: new Date().toISOString()
          };
          
          const filePath = `${databaseDirPath}/worship_lists.json`;
          const jsonData = JSON.stringify(worshipListsData, null, 2);
          
          await window.electronAPI.writeFile(filePath, jsonData);
          
          // OneDrive 업로드 성공 시 시간 저장
          const currentData = loadFromStorage('songs', { songs: [], worshipLists: {} });
          currentData.lastOneDriveSync = new Date().toISOString();
          localStorage.setItem('worshipnote_data', JSON.stringify(currentData));
        }
      } catch (oneDriveError) {
        // OneDrive 저장 실패해도 localStorage는 성공했으므로 계속 진행
      }
    }
    
    return success;
  } catch (error) {
    return false;
  }
};

export const loadWorshipLists = async () => {
  try {
    // console.log('loadWorshipLists 시작 - Electron API:', !!window.electronAPI);
    
    // Electron API가 없으면 localStorage에서만 로드
    if (!window.electronAPI) {
      // console.log('Electron API 없음 - localStorage에서만 로드');
      const localData = loadFromStorage('worshipLists', null);
      return localData || {};
    }
    
    // 먼저 localStorage에서 로드 시도 (최신 복원 데이터가 있을 수 있음)
    const localData = loadFromStorage('worshipLists', null);
    if (localData && Object.keys(localData).length > 0) {
      // console.log('localStorage에서 로드된 worshipLists:', Object.keys(localData).length, '개');
      
      // localStorage에 데이터가 있으면 OneDrive와 동기화 시도
      if (window.electronAPI && window.electronAPI.readFile) {
        try {
          const oneDrivePath = await window.electronAPI.getOneDrivePath();
          if (oneDrivePath) {
            const filePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
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
              
              const worshipListsData = JSON.parse(jsonString);
              // console.log('OneDrive에서 로드된 worshipLists:', Object.keys(worshipListsData.worshipLists || {}).length, '개');
              
              // OneDrive 데이터와 localStorage 데이터 비교
              const localTimestamp = localStorage.getItem('worshipnote_data') ? 
                JSON.parse(localStorage.getItem('worshipnote_data')).lastSaved : null;
              const oneDriveTimestamp = worshipListsData.lastUpdated;
              
              // console.log('타임스탬프 비교:', { localTimestamp, oneDriveTimestamp });
              
              // localStorage가 더 최신이면 localStorage 데이터 사용
              if (localTimestamp && oneDriveTimestamp && localTimestamp > oneDriveTimestamp) {
                // console.log('localStorage 데이터가 더 최신이므로 사용');
                return localData;
              } else {
                // console.log('OneDrive 데이터가 더 최신이므로 사용');
                saveToStorage('worshipLists', worshipListsData.worshipLists);
                return worshipListsData.worshipLists || {};
              }
            }
          }
        } catch (oneDriveError) {
          // console.log('OneDrive 동기화 실패, localStorage 데이터 사용:', oneDriveError.message);
        }
      }
      
      return localData;
    }
    
    // localStorage에 데이터가 없으면 OneDrive에서 로드 시도
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const filePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
          const fileResult = await window.electronAPI.readFile(filePath);
          
          if (fileResult && fileResult.success && fileResult.data) {
            // 파일 데이터가 ArrayBuffer인 경우 문자열로 변환
            let jsonString;
            if (fileResult.data instanceof ArrayBuffer) {
              const uint8Array = new Uint8Array(fileResult.data);
              jsonString = new TextDecoder('utf-8').decode(uint8Array);
            } else if (typeof fileResult.data === 'string') {
              jsonString = fileResult.data;
            } else {
              throw new Error('지원하지 않는 파일 데이터 형식');
            }
            
            const worshipListsData = JSON.parse(jsonString);
            
            // localStorage에도 저장 (동기화)
            saveToStorage('worshipLists', worshipListsData.worshipLists);
            
            return worshipListsData.worshipLists || {};
          }
        }
      } catch (oneDriveError) {
        // OneDrive 로드 실패 시 public/data.json에서 로드
        try {
          const response = await fetch('/data.json');
          if (response.ok) {
            const data = await response.json();
            const worshipLists = data.worshipLists || {};
            
            // localStorage에도 저장 (동기화)
            saveToStorage('worshipLists', worshipLists);
            
            return worshipLists;
          }
        } catch (fetchError) {
        }
      }
    } else {
      // 웹 환경에서는 public/data.json에서 로드
      try {
        const response = await fetch('/data.json');
        if (response.ok) {
          const data = await response.json();
          const worshipLists = data.worshipLists || {};
          
          // localStorage에도 저장 (동기화)
          saveToStorage('worshipLists', worshipLists);
          
          return worshipLists;
        }
      } catch (fetchError) {
      }
    }
    
    // OneDrive/웹에서 로드 실패하면 localStorage에서 로드
    const localWorshipLists = loadFromStorage('worshipLists', {});
    return localWorshipLists;
  } catch (error) {
    return {};
  }
};

// 데이터 초기화
export const initializeData = async () => {
  try {
    // Electron API가 없으면 기본 데이터 반환
    if (!window.electronAPI) {
      return {
        songs: [],
        worshipLists: {}
      };
    }
    
    const songs = await loadSongs();
    const worshipLists = await loadWorshipLists();
    
    return {
      songs,
      worshipLists
    };
  } catch (error) {
    return {
      songs: [],
      worshipLists: {}
    };
  }
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
        }
      } else {
        // createDirectory가 없으면 빈 파일로 디렉토리 생성 시도
        await window.electronAPI.writeFile(`${backupDirPath}/.gitkeep`, '');
      }
    } catch (dirError) {
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
        }
      } else {
        // createDirectory가 없으면 빈 파일로 디렉토리 생성 시도
        await window.electronAPI.writeFile(`${backupDirPath}/.gitkeep`, '');
      }
    } catch (dirError) {
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
      message: `통합 데이터베이스 백업이 생성되었습니다!\n\n📊 데이터 현황:\n• 찬양 개수: ${songs.length}개\n• 악보 없는 찬양: ${songsWithoutMusicSheet}개\n• 찬양 리스트: ${Object.keys(worshipLists).length}개\n• 파일 크기: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      stats: databaseData.stats,
      fileName: backupFileName
    };
  } catch (error) {
    return { success: false, error: `백업 생성 중 오류가 발생했습니다: ${error.message}` };
  }
};

// 통합 데이터베이스 복원
export const restoreDatabaseFromBackup = async (backupFilePath, setSongs, setWorshipLists) => {
  try {
    if (!window.electronAPI || !window.electronAPI.readFile) {
      return { success: false, error: 'Electron API가 사용할 수 없습니다.' };
    }
    
    const fileResult = await window.electronAPI.readFile(backupFilePath);
    
    // 파일 읽기 결과 검증
    if (!fileResult) {
      return { success: false, error: '백업 파일을 읽을 수 없습니다.' };
    }
    
    if (!fileResult.success) {
      return { success: false, error: fileResult.error || '백업 파일 읽기에 실패했습니다.' };
    }
    
    // 파일 데이터가 ArrayBuffer인 경우 문자열로 변환
    let jsonString;
    if (fileResult.data instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(fileResult.data);
      jsonString = new TextDecoder('utf-8').decode(uint8Array);
    } else if (typeof fileResult.data === 'string') {
      jsonString = fileResult.data;
    } else {
      return { success: false, error: '지원하지 않는 파일 형식입니다.' };
    }
    
    // JSON 파싱 시도
    let backupData;
    try {
      backupData = JSON.parse(jsonString);
    } catch (parseError) {
      return { 
        success: false, 
        error: `백업 파일 형식이 올바르지 않습니다.\n오류: ${parseError.message}\n파일 내용: ${jsonString ? jsonString.substring(0, 100) : '파일 내용 없음'}...` 
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
    
    // console.log('복원할 데이터:', { songs: songs.length, worshipLists: Object.keys(worshipLists).length });
    
    // localStorage에 저장
    saveToStorage('songs', songs);
    saveToStorage('worshipLists', worshipLists);
    
    // OneDrive에도 직접 저장 (saveSongs/saveWorshipLists 함수 사용)
    let songsResult = false;
    let worshipListsResult = false;
    
    try {
      // console.log('OneDrive에 songs 저장 시작...');
      songsResult = await saveSongs(songs);
      // console.log('songs 저장 결과:', songsResult);
      
      // 저장 후 즉시 확인
      if (songsResult) {
        // console.log('songs 저장 성공 - OneDrive 동기화 확인');
      } else {
        console.error('songs 저장 실패 - OneDrive 동기화 실패');
      }
    } catch (error) {
      console.error('songs 저장 실패:', error);
    }
    
    try {
      // console.log('OneDrive에 worshipLists 저장 시작...');
      worshipListsResult = await saveWorshipLists(worshipLists);
      // console.log('worshipLists 저장 결과:', worshipListsResult);
      
      // 저장 후 즉시 확인
      if (worshipListsResult) {
        // console.log('worshipLists 저장 성공 - OneDrive 동기화 확인');
      } else {
        console.error('worshipLists 저장 실패 - OneDrive 동기화 실패');
      }
    } catch (error) {
      console.error('worshipLists 저장 실패:', error);
    }
    
    // React 상태 업데이트
    if (setSongs) setSongs(songs);
    if (setWorshipLists) setWorshipLists(worshipLists);
    
    // console.log('복원 완료 - localStorage와 OneDrive에 저장됨');
    
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
    return { success: false, error: `복원 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류가 발생했습니다.'}` };
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
    return { success: false, error: error.message };
  }
};

// 찬양 리스트 복원 (기존 함수 유지)
export const restoreWorshipListsFromBackup = async (backupFilePath) => {
  try {
    if (window.electronAPI && window.electronAPI.readFile) {
      const fileResult = await window.electronAPI.readFile(backupFilePath);
      
      if (fileResult && fileResult.success && fileResult.data) {
        // 파일 데이터가 ArrayBuffer인 경우 문자열로 변환
        let jsonString;
        if (fileResult.data instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(fileResult.data);
          jsonString = new TextDecoder('utf-8').decode(uint8Array);
        } else if (typeof fileResult.data === 'string') {
          jsonString = fileResult.data;
        } else {
          return { success: false, error: '지원하지 않는 파일 데이터 형식' };
        }
        
        const backupData = JSON.parse(jsonString);
        
        if (backupData.worshipLists) {
          await saveWorshipLists(backupData.worshipLists);
          return { success: true };
        } else {
          return { success: false, error: 'Invalid backup file format' };
        }
      } else {
        return { success: false, error: fileResult?.error || '파일 읽기 실패' };
      }
    }
    return { success: false, error: 'OneDrive API not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// OneDrive 동기화 상태 확인 및 강제 동기화
export const forceSyncToOneDrive = async (currentSongs = null, currentWorshipLists = null) => {
  try {
    if (!window.electronAPI || !window.electronAPI.writeFile) {
      return { success: false, error: 'OneDrive API가 사용할 수 없습니다.' };
    }
    
    // console.log('강제 동기화 시작...');
    
    // 현재 앱에 로드된 데이터 사용 (매개변수로 전달된 경우)
    let songs, worshipLists;
    
    if (currentSongs && currentWorshipLists) {
      // console.log('앱에서 전달된 데이터 사용');
      songs = currentSongs;
      worshipLists = currentWorshipLists;
    } else {
      // console.log('localStorage에서 데이터 로드');
      // localStorage의 데이터 가져오기
      const localData = loadFromStorage('songs', { songs: [], worshipLists: {} });
      songs = localData.songs || [];
      worshipLists = localData.worshipLists || {};
    }
    
    // console.log('동기화할 데이터:', { songs: songs.length, worshipLists: Object.keys(worshipLists).length });
    
    // 데이터가 비어있으면 동기화하지 않음
    if (songs.length === 0 && Object.keys(worshipLists).length === 0) {
      return { 
        success: false, 
        error: '동기화할 데이터가 없습니다. 먼저 데이터를 추가하거나 복원해주세요.' 
      };
    }
    
    // OneDrive에 강제 저장
    const songsResult = await saveSongs(songs);
    const worshipListsResult = await saveWorshipLists(worshipLists);
    
    // console.log('강제 동기화 결과:', { songsResult, worshipListsResult });
    
    return { 
      success: songsResult && worshipListsResult, 
      message: `OneDrive 동기화가 완료되었습니다.\n악보: ${songs.length}개, 찬양 리스트: ${Object.keys(worshipLists).length}개` 
    };
  } catch (error) {
    console.error('강제 동기화 실패:', error);
    return { success: false, error: error.message };
  }
};

// OneDrive와 로컬 데이터베이스의 최신 버전 비교 (개선된 버전)
export const compareDatabaseVersions = async () => {
  try {
    let localSongsTime = null;
    let localWorshipListsTime = null;
    let oneDriveSongsTime = null;
    let oneDriveWorshipListsTime = null;
    
    // 로컬 데이터베이스의 마지막 저장 시간 확인
    try {
      const localData = localStorage.getItem('worshipnote_data');
      if (localData) {
        const parsedData = JSON.parse(localData);
        if (parsedData.lastSaved) {
          localSongsTime = new Date(parsedData.lastSaved);
          localWorshipListsTime = new Date(parsedData.lastSaved);
        }
        if (parsedData.lastOneDriveSync) {
          const syncTime = new Date(parsedData.lastOneDriveSync);
          if (!localSongsTime || syncTime > localSongsTime) {
            localSongsTime = syncTime;
          }
          if (!localWorshipListsTime || syncTime > localWorshipListsTime) {
            localWorshipListsTime = syncTime;
          }
        }
      }
    } catch (error) {
    }
    
    // OneDrive 데이터베이스의 마지막 업데이트 시간 확인
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const songsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
          const worshipListsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
          
          // songs.json 확인
          try {
            const songsResult = await window.electronAPI.readFile(songsFilePath);
            if (songsResult && songsResult.success && songsResult.data) {
              let jsonString;
              if (songsResult.data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(songsResult.data);
                jsonString = new TextDecoder('utf-8').decode(uint8Array);
              } else if (typeof songsResult.data === 'string') {
                jsonString = songsResult.data;
              } else {
                throw new Error('지원하지 않는 파일 데이터 형식');
              }
              
              const songsJson = JSON.parse(jsonString);
              if (songsJson.lastUpdated) {
                oneDriveSongsTime = new Date(songsJson.lastUpdated);
              }
            }
          } catch (error) {
            // 파일이 없거나 읽기 실패 시 무시
          }
          
          // worship_lists.json 확인
          try {
            const worshipListsResult = await window.electronAPI.readFile(worshipListsFilePath);
            if (worshipListsResult && worshipListsResult.success && worshipListsResult.data) {
              let jsonString;
              if (worshipListsResult.data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(worshipListsResult.data);
                jsonString = new TextDecoder('utf-8').decode(uint8Array);
              } else if (typeof worshipListsResult.data === 'string') {
                jsonString = worshipListsResult.data;
              } else {
                throw new Error('지원하지 않는 파일 데이터 형식');
              }
              
              const worshipListsJson = JSON.parse(jsonString);
              if (worshipListsJson.lastUpdated) {
                oneDriveWorshipListsTime = new Date(worshipListsJson.lastUpdated);
              }
            }
          } catch (error) {
            // 파일이 없거나 읽기 실패 시 무시
          }
        }
      } catch (oneDriveError) {
      }
    }
    
    // 파일별로 동기화 필요 여부 확인
    const needsSongsSync = oneDriveSongsTime && (!localSongsTime || oneDriveSongsTime > localSongsTime);
    const needsWorshipListsSync = oneDriveWorshipListsTime && (!localWorshipListsTime || oneDriveWorshipListsTime > localWorshipListsTime);
    
    const needsSync = needsSongsSync || needsWorshipListsSync;
    
    // 가장 최근 시간 계산
    const latestLocalTime = localSongsTime && localWorshipListsTime 
      ? (localSongsTime > localWorshipListsTime ? localSongsTime : localWorshipListsTime)
      : (localSongsTime || localWorshipListsTime);
      
    const latestOneDriveTime = oneDriveSongsTime && oneDriveWorshipListsTime
      ? (oneDriveSongsTime > oneDriveWorshipListsTime ? oneDriveSongsTime : oneDriveWorshipListsTime)
      : (oneDriveSongsTime || oneDriveWorshipListsTime);
    
    // 동기화 이유 결정
    let reason = 'no_sync_needed';
    if (needsSongsSync && needsWorshipListsSync) {
      reason = 'onedrive_both_newer';
    } else if (needsSongsSync) {
      reason = 'onedrive_songs_newer';
    } else if (needsWorshipListsSync) {
      reason = 'onedrive_worship_lists_newer';
    } else if (!latestLocalTime && !latestOneDriveTime) {
      reason = 'both_empty';
    } else if (!latestLocalTime && latestOneDriveTime) {
      reason = 'local_empty';
    } else if (latestLocalTime && !latestOneDriveTime) {
      reason = 'onedrive_empty';
    }
    
    return {
      success: true,
      needsSync,
      reason,
      localTime: latestLocalTime,
      oneDriveTime: latestOneDriveTime,
      details: {
        localSongsTime,
        localWorshipListsTime,
        oneDriveSongsTime,
        oneDriveWorshipListsTime,
        needsSongsSync,
        needsWorshipListsSync
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// OneDrive에서 로컬로 데이터 동기화
export const syncFromOneDrive = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.readFile) {
      return { success: false, error: 'OneDrive API가 사용할 수 없습니다.' };
    }
    
    const oneDrivePath = await window.electronAPI.getOneDrivePath();
    if (!oneDrivePath) {
      return { success: false, error: 'OneDrive 경로를 찾을 수 없습니다.' };
    }
    
    const songsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
    const worshipListsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
    
    let songs = [];
    let worshipLists = {};
    let syncTime = new Date();
    
    // songs.json 로드
    try {
      const songsResult = await window.electronAPI.readFile(songsFilePath);
      if (songsResult && songsResult.success && songsResult.data) {
        let jsonString;
        if (songsResult.data instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(songsResult.data);
          jsonString = new TextDecoder('utf-8').decode(uint8Array);
        } else if (typeof songsResult.data === 'string') {
          jsonString = songsResult.data;
        } else {
          throw new Error('지원하지 않는 파일 데이터 형식');
        }
        
        const songsJson = JSON.parse(jsonString);
        songs = songsJson.songs || [];
        if (songsJson.lastUpdated) {
          syncTime = new Date(songsJson.lastUpdated);
        }
      }
    } catch (error) {
    }
    
    // worship_lists.json 로드
    try {
      const worshipListsResult = await window.electronAPI.readFile(worshipListsFilePath);
      if (worshipListsResult && worshipListsResult.success && worshipListsResult.data) {
        let jsonString;
        if (worshipListsResult.data instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(worshipListsResult.data);
          jsonString = new TextDecoder('utf-8').decode(uint8Array);
        } else if (typeof worshipListsResult.data === 'string') {
          jsonString = worshipListsResult.data;
        } else {
          throw new Error('지원하지 않는 파일 데이터 형식');
        }
        
        const worshipListsJson = JSON.parse(jsonString);
        worshipLists = worshipListsJson.worshipLists || {};
        if (worshipListsJson.lastUpdated && new Date(worshipListsJson.lastUpdated) > syncTime) {
          syncTime = new Date(worshipListsJson.lastUpdated);
        }
      }
    } catch (error) {
    }
    
    // 로컬에 저장
    const syncData = {
      songs,
      worshipLists,
      lastSaved: syncTime.toISOString(),
      lastOneDriveSync: syncTime.toISOString()
    };
    
    localStorage.setItem('worshipnote_data', JSON.stringify(syncData));
    
    return {
      success: true,
      songs,
      worshipLists,
      syncTime,
      message: `OneDrive에서 데이터를 동기화했습니다.\n\n📊 동기화된 데이터:\n• 찬양: ${songs.length}개\n• 찬양 리스트: ${Object.keys(worshipLists).length}개\n• 동기화 시간: ${syncTime.toLocaleString('ko-KR')}`
    };
  } catch (error) {
    return {
      success: false,
      error: `동기화 중 오류가 발생했습니다: ${error.message}`
    };
  }
};

// 파일 존재 여부 확인 함수
export const checkFileExists = async (filePath) => {
  try {
    if (!window.electronAPI || !window.electronAPI.readFile) {
      return false;
    }
    
    const fileData = await window.electronAPI.readFile(filePath);
    const exists = fileData !== null && fileData !== undefined;
    return exists;
  } catch (error) {
    return false;
  }
};

// 데이터베이스 마지막 저장 날짜와 OneDrive 동기화 시간 가져오기
export const getDatabaseLastUpdated = async () => {
  try {
    let lastUpdated = null;
    
    // OneDrive에서 최신 업데이트 시간 확인
    if (window.electronAPI && window.electronAPI.readFile) {
      try {
        const oneDrivePath = await window.electronAPI.getOneDrivePath();
        if (oneDrivePath) {
          const songsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/songs.json`;
          const worshipListsFilePath = `${oneDrivePath}/WorshipNote_Data/Database/worship_lists.json`;
          
          let latestUpdate = null;
          
          // songs.json 확인
          try {
            const songsResult = await window.electronAPI.readFile(songsFilePath);
            if (songsResult && songsResult.success && songsResult.data) {
              let jsonString;
              if (songsResult.data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(songsResult.data);
                jsonString = new TextDecoder('utf-8').decode(uint8Array);
              } else if (typeof songsResult.data === 'string') {
                jsonString = songsResult.data;
              } else {
                throw new Error('지원하지 않는 파일 데이터 형식');
              }
              
              const songsJson = JSON.parse(jsonString);
              if (songsJson.lastUpdated) {
                latestUpdate = new Date(songsJson.lastUpdated);
              }
            }
          } catch (error) {
            // 파일이 없거나 읽기 실패 시 무시
          }

          // worship_lists.json 확인
          try {
            const worshipListsResult = await window.electronAPI.readFile(worshipListsFilePath);
            if (worshipListsResult && worshipListsResult.success && worshipListsResult.data) {
              let jsonString;
              if (worshipListsResult.data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(worshipListsResult.data);
                jsonString = new TextDecoder('utf-8').decode(uint8Array);
              } else if (typeof worshipListsResult.data === 'string') {
                jsonString = worshipListsResult.data;
              } else {
                throw new Error('지원하지 않는 파일 데이터 형식');
              }
              
              const worshipListsJson = JSON.parse(jsonString);
              if (worshipListsJson.lastUpdated) {
                const worshipListsUpdate = new Date(worshipListsJson.lastUpdated);
                if (!latestUpdate || worshipListsUpdate > latestUpdate) {
                  latestUpdate = worshipListsUpdate;
                }
              }
            }
          } catch (error) {
            // 파일이 없거나 읽기 실패 시 무시
          }
          
          lastUpdated = latestUpdate;
        }
      } catch (oneDriveError) {
      }
    }
    
    // OneDrive에서 가져올 수 없으면 localStorage에서 확인
    if (!lastUpdated) {
      try {
        const localData = localStorage.getItem('worshipnote_data');
        if (localData) {
          const parsedData = JSON.parse(localData);
          if (parsedData.lastSaved) {
            lastUpdated = new Date(parsedData.lastSaved);
          }
        }
      } catch (error) {
      }
    }
    
    return {
      success: true,
      lastUpdated
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

