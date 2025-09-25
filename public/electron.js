const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');

// 한글 파일명 처리를 위한 인코딩 설정
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

// 캐시 관련 에러 방지 설정
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_DISABLE_GPU = 'false';
process.env.ELECTRON_ENABLE_LOGGING = 'false';

// React DevTools 완전 비활성화
process.env.REACT_APP_DISABLE_DEVTOOLS = 'true';
process.env.NODE_ENV = 'production';

// OneDrive 파일 동기화 상태 확인 함수
async function checkOneDriveSyncStatus(filePath) {
  try {
    // 파일이 OneDrive 경로에 있는지 확인
    if (!filePath.includes('OneDrive') && !filePath.includes('CloudStorage')) {
      return { isOneDrive: false, isSynced: true };
    }
    
    // 파일 존재 여부를 빠르게 확인 (타임아웃 3초)
    const exists = await Promise.race([
      fsPromises.access(filePath).then(() => true).catch(() => false),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]).catch(() => false);
    
    if (!exists) {
      return { isOneDrive: true, isSynced: false };
    }
    
    // 파일 크기 확인 (0바이트면 동기화되지 않음)
    const stats = await fsPromises.stat(filePath);
    const isSynced = stats.size > 0;
    
    return { isOneDrive: true, isSynced };
  } catch (error) {
    return { isOneDrive: true, isSynced: false };
  }
}

// 개발 모드 감지 (electron-is-dev 대신 직접 구현)
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_IS_DEV === '1' || 
              process.defaultApp || 
              /[\\/]electron/.test(process.execPath);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      // 캐시 관련 설정 추가
      cache: false,
      disableBackgroundTimer: true,
      disableBackgroundThrottling: true,
      disableRendererBackgrounding: true,
      // DevTools 관련 설정
      devTools: true,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 개발자 도구는 수동으로 열도록 변경 (F12 키로 열 수 있음)
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// OneDrive 경로 찾기 함수
const findOneDrivePath = () => {
    const homeDir = os.homedir();
  const platform = os.platform();
  
  let possiblePaths = [];
  
  if (platform === 'darwin') {
    // macOS 경로들
    possiblePaths = [
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-Personal'),
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-회사명'),
      path.join(homeDir, 'OneDrive'), // 심볼릭 링크 경로
      path.join(homeDir, 'Documents') // 폴백 경로
    ];
  } else if (platform === 'win32') {
    // Windows 경로들
    possiblePaths = [
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'OneDrive - Personal'),
      path.join(homeDir, 'OneDrive - 회사명'),
      path.join(homeDir, 'Documents') // 폴백 경로
    ];
  } else {
    // Linux/기타 OS
    possiblePaths = [
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'Documents') // 폴백 경로
    ];
  }

    for (const oneDrivePath of possiblePaths) {
      try {
      if (require('fs').existsSync(oneDrivePath)) {
        return oneDrivePath;
      }
    } catch (error) {
      continue;
    }
  }
  
  // OneDrive 폴더가 없으면 첫 번째 가능한 경로에 생성 시도
  const firstOneDrivePath = possiblePaths[0];
  try {
    require('fs').mkdirSync(firstOneDrivePath, { recursive: true });
    return firstOneDrivePath;
  } catch (error) {
  }
  
  // 폴백 경로 사용
  const fallbackPath = path.join(homeDir, 'Documents', 'WorshipNote_Data');
  return fallbackPath;
};

// Music_Sheets 경로 찾기 함수
const findMusicSheetsPath = () => {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  let possiblePaths = [];
  
  if (platform === 'darwin') {
    // macOS 경로들
    possiblePaths = [
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-Personal', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-회사명', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data', 'Music_Sheets'), // 심볼릭 링크 경로
      path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets') // 폴백 경로
    ];
  } else if (platform === 'win32') {
    // Windows 경로들
    possiblePaths = [
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'OneDrive - Personal', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'OneDrive - 회사명', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets') // 폴백 경로
    ];
  } else {
    // Linux/기타 OS
    possiblePaths = [
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data', 'Music_Sheets'),
      path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets') // 폴백 경로
    ];
  }
  
  for (const musicSheetsPath of possiblePaths) {
    try {
      if (require('fs').existsSync(musicSheetsPath)) {
        return musicSheetsPath;
      }
  } catch (error) {
      continue;
  }
}

  // Music_Sheets 폴더가 없으면 첫 번째 가능한 경로에 생성 시도
  const firstMusicSheetsPath = possiblePaths[0];
  try {
    require('fs').mkdirSync(firstMusicSheetsPath, { recursive: true });
    return firstMusicSheetsPath;
  } catch (error) {
  }
  
  // 폴백 경로 사용
  const fallbackPath = path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets');
  return fallbackPath;
};

// 폴더 생성 함수
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('폴더 생성 실패:', error);
    return false;
  }
};


app.whenReady().then(() => {
  // 캐시 디렉토리 설정 (에러 방지)
  const userDataPath = app.getPath('userData');
  const cachePath = path.join(userDataPath, 'cache');
  
  // 캐시 디렉토리 생성
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
  
  // 캐시 관련 환경 변수 설정
  process.env.ELECTRON_CACHE_DIR = cachePath;
  
  createWindow();

  // IPC 핸들러 등록
  ipcMain.handle('get-onedrive-path', async () => {
    return findOneDrivePath();
  });

  ipcMain.handle('get-music-sheets-path', async () => {
    return findMusicSheetsPath();
  });

  ipcMain.handle('get-music-sheets-files', async () => {
    try {
      const musicSheetsPath = findMusicSheetsPath();
      const files = await fsPromises.readdir(musicSheetsPath);
      return files.filter(file => 
        file.toLowerCase().endsWith('.jpg') || 
        file.toLowerCase().endsWith('.jpeg') || 
        file.toLowerCase().endsWith('.png') ||
        file.toLowerCase().endsWith('.gif')
      );
    } catch (error) {
      console.error('Music_Sheets 파일 목록 읽기 실패:', error);
      return [];
    }
  });

  ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return { success: true, exists: true };
    } catch (error) {
      return { success: true, exists: false };
    }
  });

  ipcMain.handle('create-directory', async (event, dirPath) => {
    try {
      await ensureDirectoryExists(dirPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
      await ensureDirectoryExists(path.dirname(filePath));
      await fsPromises.writeFile(filePath, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-file', async (event, fileData) => {
    try {
      const { arrayBuffer, fileName, folderPath } = fileData;
      const fullPath = path.join(folderPath, fileName);
      
      // 디렉토리가 존재하지 않으면 생성
      await ensureDirectoryExists(folderPath);
      
      // ArrayBuffer를 Buffer로 변환하여 저장
      const buffer = Buffer.from(arrayBuffer);
      await fsPromises.writeFile(fullPath, buffer);
      
      return { success: true, filePath: fullPath };
    } catch (error) {
      console.error('파일 저장 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // PDF 저장 핸들러
  ipcMain.handle('save-pdf', async (event, pdfData) => {
    try {
      const { arrayBuffer, fileName, folderPath, overwrite } = pdfData;
      
      // 매개변수 유효성 검사
      if (!arrayBuffer) {
        throw new Error('arrayBuffer가 제공되지 않았습니다.');
      }
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('fileName이 유효하지 않습니다.');
      }
      if (!folderPath || typeof folderPath !== 'string') {
        throw new Error('folderPath가 유효하지 않습니다.');
      }
      
      const fullPath = path.normalize(path.join(folderPath, fileName));
      
      // 파일이 이미 존재하는지 확인
      let fileExists = false;
      try {
        const stats = await fsPromises.stat(fullPath);
        fileExists = stats.isFile();
      } catch (error) {
        // 파일이 존재하지 않거나 접근할 수 없음
        fileExists = false;
      }
      
      if (fileExists && overwrite !== true) {
        return { 
          success: false, 
          needsConfirmation: true, 
          filePath: fullPath,
          message: `파일 "${fileName}"이 이미 존재합니다. 덮어쓰시겠습니까?`
        };
      }
      
      // 디렉토리가 존재하지 않으면 생성
      await ensureDirectoryExists(folderPath);
      
      // ArrayBuffer를 Buffer로 변환하여 저장
      const buffer = Buffer.from(arrayBuffer);
      await fsPromises.writeFile(fullPath, buffer);
      
      return { success: true, filePath: fullPath };
    } catch (error) {
      console.error('PDF 저장 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // 파일 읽기 핸들러
  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      // OneDrive 동기화 상태 확인
      const syncStatus = await checkOneDriveSyncStatus(filePath);
      
      if (syncStatus.isOneDrive && !syncStatus.isSynced) {
        return { 
          success: false, 
          error: 'OneDrive 파일이 로컬에 동기화되지 않았습니다. OneDrive에서 파일을 다운로드하거나 동기화를 확인해주세요.',
          isOneDriveFile: true,
          needsSync: true
        };
      }
      
      // 파일 읽기 (타임아웃 설정)
      const data = await Promise.race([
        fsPromises.readFile(filePath),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 15000))
      ]);
      
      return { 
        success: true, 
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        fileName: path.basename(filePath)
      };
    } catch (error) {
      console.error('파일 읽기 실패:', error);
      
      if (error.code === 'ETIMEDOUT' || error.message === 'ETIMEDOUT') {
        return { 
          success: false, 
          error: '파일 읽기 시간 초과. OneDrive 파일의 경우 로컬 동기화를 확인해주세요.',
          isTimeout: true,
          isOneDriveFile: filePath.includes('OneDrive') || filePath.includes('CloudStorage')
        };
      }
      
      if (error.code === 'ENOENT') {
        return { 
          success: false, 
          error: '파일을 찾을 수 없습니다.',
          isNotFound: true
        };
      }
      
      return { success: false, error: error.message };
    }
  });

  // 파일 삭제 핸들러
  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      // 파일 존재 여부 확인
      const exists = await fsPromises.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return { success: false, error: '파일이 존재하지 않습니다.' };
      }
      
      // 파일 삭제
      await fsPromises.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // 파일 이름 변경 핸들러
  ipcMain.handle('rename-file', async (event, ...args) => {
    const [oldFilePath, newFilePath] = args;
    try {
      // 기존 파일 존재 여부 확인
      const exists = await fsPromises.access(oldFilePath).then(() => true).catch(() => false);
      if (!exists) {
        return { success: false, error: '기존 파일이 존재하지 않습니다.' };
      }
      
      // 새 파일 경로의 디렉토리가 존재하는지 확인하고 없으면 생성
      const newDir = path.dirname(newFilePath);
      await ensureDirectoryExists(newDir);
      
      // 파일 이름 변경
      await fsPromises.rename(oldFilePath, newFilePath);
      return { success: true, newFilePath };
    } catch (error) {
      console.error('파일 이름 변경 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // 파일 열기 핸들러
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      const { shell } = require('electron');
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('파일 열기 실패:', error);
      return { success: false, error: error.message };
    }
  });


  // OneDrive 파일 동기화 상태 확인 핸들러
  ipcMain.handle('check-onedrive-sync', async (event, filePath) => {
    try {
      const syncStatus = await checkOneDriveSyncStatus(filePath);
      return { success: true, ...syncStatus };
    } catch (error) {
      console.error('OneDrive 동기화 상태 확인 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // OneDrive 폴더 동기화 상태 일괄 확인 핸들러
  ipcMain.handle('check-onedrive-folder-sync', async (event, folderPath) => {
    try {
      if (!folderPath.includes('OneDrive') && !folderPath.includes('CloudStorage')) {
        return { success: true, isOneDrive: false, syncedFiles: [], unsyncedFiles: [] };
      }
      
      const files = await fsPromises.readdir(folderPath, { withFileTypes: true });
      const fileList = files.filter(file => file.isFile()).map(file => path.join(folderPath, file.name));
      
      const syncResults = await Promise.all(
        fileList.map(async (filePath) => {
          const syncStatus = await checkOneDriveSyncStatus(filePath);
          return { filePath, ...syncStatus };
        })
      );
      
      const syncedFiles = syncResults.filter(result => result.isSynced).map(result => result.filePath);
      const unsyncedFiles = syncResults.filter(result => !result.isSynced).map(result => result.filePath);
      
      return {
        success: true,
        isOneDrive: true,
        syncedFiles,
        unsyncedFiles,
        totalFiles: fileList.length,
        syncedCount: syncedFiles.length,
        unsyncedCount: unsyncedFiles.length
      };
    } catch (error) {
      console.error('OneDrive 폴더 동기화 상태 확인 실패:', error);
      return { success: false, error: error.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
