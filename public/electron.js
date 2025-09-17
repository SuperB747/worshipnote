const { app, BrowserWindow, ipcMain } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

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
  const possiblePaths = [
    path.join(homeDir, 'OneDrive', 'WorshipNote_Data'),
    path.join(homeDir, 'OneDrive - Personal', 'WorshipNote_Data'),
    path.join(homeDir, 'OneDrive - 회사명', 'WorshipNote_Data'),
    path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets') // 폴백 경로
  ];
  
  for (const oneDrivePath of possiblePaths) {
    try {
      if (require('fs').existsSync(oneDrivePath)) {
        return oneDrivePath;
      }
    } catch (error) {
      continue;
    }
  }
  
  // OneDrive 폴더가 없으면 Documents에 생성
  return path.join(homeDir, 'Documents', 'WorshipNote_Data');
};

// Music_Sheets 경로 찾기 함수
const findMusicSheetsPath = () => {
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(homeDir, 'OneDrive', 'WorshipNote_Data', 'Music_Sheets'),
    path.join(homeDir, 'OneDrive - Personal', 'WorshipNote_Data', 'Music_Sheets'),
    path.join(homeDir, 'OneDrive - 회사명', 'WorshipNote_Data', 'Music_Sheets'),
    path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets') // 폴백 경로
  ];
  
  for (const musicSheetsPath of possiblePaths) {
    try {
      if (require('fs').existsSync(musicSheetsPath)) {
        return musicSheetsPath;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Music_Sheets 폴더가 없으면 Documents에 생성
  return path.join(homeDir, 'Documents', 'WorshipNote_Data', 'Music_Sheets');
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
    
    // 파일 저장
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(fullPath, buffer);
    
    return {
      success: true,
      filePath: fullPath,
      message: `파일이 저장되었습니다: ${fullPath}`
    };
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
    // 파일 존재 여부 확인
    try {
      await fs.access(filePath);
    } catch (accessError) {
      // 파일이 존재하지 않으면 null 반환 (에러를 던지지 않음)
      console.log('파일이 존재하지 않음:', filePath);
      return null;
    }
    
    const buffer = await fs.readFile(filePath);
    
    // JSON 파일인 경우 문자열로 변환
    if (filePath.endsWith('.json')) {
      return buffer.toString('utf8');
    }
    
    // 이미지 파일인 경우 Buffer 그대로 반환
    return buffer;
  } catch (error) {
    console.error('파일 읽기 실패:', error);
    // ENOENT 오류(파일 없음)는 null 반환, 다른 오류는 에러 던지기
    if (error.code === 'ENOENT') {
      console.log('파일이 존재하지 않음:', filePath);
      return null;
    }
    throw new Error(`파일을 읽을 수 없습니다: ${error.message}`);
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    console.log('파일 삭제 시도:', filePath);
    
    // 파일 존재 여부 확인
    try {
      await fs.access(filePath);
    } catch (accessError) {
      console.log('파일이 존재하지 않음:', filePath);
      return {
        success: true,
        message: '파일이 이미 존재하지 않습니다.'
      };
    }
    
    // 파일 삭제
    await fs.unlink(filePath);
    console.log('파일 삭제 성공:', filePath);
    
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
