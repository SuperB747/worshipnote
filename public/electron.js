const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 한글 파일명 처리를 위한 인코딩 설정
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

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
      preload: path.join(__dirname, 'preload.js')
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
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-Personal', 'WorshipNote_Data'),
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-회사명', 'WorshipNote_Data'),
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data'), // 심볼릭 링크 경로
      path.join(homeDir, 'Documents', 'WorshipNote_Data') // 폴백 경로
    ];
  } else if (platform === 'win32') {
    // Windows 경로들
    possiblePaths = [
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data'),
      path.join(homeDir, 'OneDrive - Personal', 'WorshipNote_Data'),
      path.join(homeDir, 'OneDrive - 회사명', 'WorshipNote_Data'),
      path.join(homeDir, 'Documents', 'WorshipNote_Data') // 폴백 경로
    ];
  } else {
    // Linux/기타 OS
    possiblePaths = [
      path.join(homeDir, 'OneDrive', 'WorshipNote_Data'),
      path.join(homeDir, 'Documents', 'WorshipNote_Data') // 폴백 경로
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
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('폴더 생성 실패:', error);
    return false;
  }
};

// IPC 핸들러 등록
ipcMain.handle('get-onedrive-path', async () => {
  return findOneDrivePath();
});

ipcMain.handle('get-music-sheets-path', async () => {
  return findMusicSheetsPath();
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
    await fs.writeFile(filePath, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, fileData) => {
  try {
    const { arrayBuffer, fileName, folderPath } = fileData;
    
    // Music_Sheets 경로 찾기
    const musicSheetsPath = findMusicSheetsPath();
    const fullPath = path.join(musicSheetsPath, fileName);
    
    // 폴더가 없으면 생성
    await ensureDirectoryExists(musicSheetsPath);
    
    // 파일이 이미 존재하는지 확인
    try {
      await fs.access(fullPath);
      // 파일이 이미 존재하면 건너뛰고 기존 파일과 연동
      return {
        success: true,
        filePath: fullPath,
        message: `기존 파일과 연동되었습니다: ${fileName}`,
        skipped: true
      };
    } catch (accessError) {
      // 파일이 존재하지 않으면 새로 저장
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(fullPath, buffer);
      
      return {
        success: true,
        filePath: fullPath,
        message: `파일이 저장되었습니다: ${fileName}`,
        skipped: false
      };
    }
  } catch (error) {
    console.error('파일 저장 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    // 한글 파일명 처리를 위한 인코딩 정규화
    const normalizedPath = path.normalize(filePath);
    
    // 파일 존재 여부 확인
    try {
      await fs.access(normalizedPath);
    } catch (accessError) {
      // 파일이 존재하지 않으면 null 반환 (에러를 던지지 않음)
      return null;
    }
    
    const buffer = await fs.readFile(normalizedPath);
    
    // JSON 파일인 경우 문자열로 변환
    if (normalizedPath.endsWith('.json')) {
      return buffer.toString('utf8');
    }
    
    // 이미지 파일인 경우 Buffer 그대로 반환
    return buffer;
  } catch (error) {
    // ENOENT 오류(파일 없음)는 null 반환, 다른 오류는 에러 던지기
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Cannot read file: ${error.message}`);
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    
    // 파일 존재 여부 확인
    try {
      await fs.access(filePath);
    } catch (accessError) {
      return {
        success: true,
        message: '파일이 이미 존재하지 않습니다.'
      };
    }
    
    // 파일 삭제
    await fs.unlink(filePath);
    
    return {
      success: true,
      message: '파일이 성공적으로 삭제되었습니다.'
    };
  } catch (error) {
    console.error('파일 삭제 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// PDF 저장 핸들러
ipcMain.handle('save-pdf', async (event, pdfData) => {
  try {
    const { pdfBlob, filePath } = pdfData;
    
    // 디렉토리 생성
    const dirPath = path.dirname(filePath);
    await ensureDirectoryExists(dirPath);
    
    // PDF 파일 저장
    const buffer = Buffer.from(await pdfBlob.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    return {
      success: true,
      message: `PDF가 성공적으로 저장되었습니다: ${path.basename(filePath)}`,
      filePath: filePath
    };
  } catch (error) {
    console.error('PDF 저장 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(createWindow);

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
