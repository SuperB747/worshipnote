const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
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
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
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
    await fsPromises.writeFile(filePath, data);
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
    
    // 파일 저장 (기존 파일이 있으면 덮어쓰기)
    const buffer = Buffer.from(arrayBuffer);
    
    // 파일이 사용 중이어도 덮어쓰기 가능하도록 여러 방법 시도
    let writeSuccess = false;
    let lastError = null;
    
    // 방법 1: 일반적인 덮어쓰기 시도
    try {
      await fsPromises.writeFile(fullPath, buffer, { flag: 'w' });
      writeSuccess = true;
    } catch (writeError) {
      lastError = writeError;
      console.log('첫 번째 시도 실패:', writeError.code);
    }
    
    // 방법 2: 파일이 사용 중이면 잠시 대기 후 재시도
    if (!writeSuccess && (lastError.code === 'EBUSY' || lastError.code === 'EPERM')) {
      try {
        console.log('파일이 사용 중입니다. 잠시 대기 후 재시도합니다...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        await fsPromises.writeFile(fullPath, buffer, { flag: 'w' });
        writeSuccess = true;
      } catch (retryError) {
        lastError = retryError;
        console.log('재시도 실패:', retryError.code);
      }
    }
    
    // 방법 3: 임시 파일로 저장 후 이름 변경
    if (!writeSuccess) {
      try {
        console.log('임시 파일로 저장 후 이름 변경을 시도합니다...');
        const tempPath = fullPath + '.tmp';
        await fsPromises.writeFile(tempPath, buffer);
        
        // 기존 파일 삭제 시도
        try {
          await fsPromises.unlink(fullPath);
        } catch (unlinkError) {
          console.log('기존 파일 삭제 실패, 강제 덮어쓰기 시도:', unlinkError.code);
        }
        
        // 임시 파일을 원래 이름으로 변경
        await fsPromises.rename(tempPath, fullPath);
        writeSuccess = true;
      } catch (tempError) {
        lastError = tempError;
        console.log('임시 파일 방식 실패:', tempError.code);
      }
    }
    
    // 모든 방법이 실패한 경우
    if (!writeSuccess) {
      throw lastError;
    }
    
    return {
      success: true,
      filePath: fullPath,
      message: `파일이 저장되었습니다: ${fileName}`,
      skipped: false
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
    console.log('=== read-file 핸들러 시작 ===');
    console.log('요청된 파일 경로:', filePath);
    
    // 한글 파일명 처리를 위한 인코딩 정규화
    const normalizedPath = path.normalize(filePath);
    console.log('정규화된 파일 경로:', normalizedPath);
    
    // 파일 존재 여부 확인
    try {
      await fsPromises.access(normalizedPath);
      console.log('파일 존재 확인됨');
    } catch (accessError) {
      console.log('파일이 존재하지 않음:', accessError.message);
      // 파일이 존재하지 않으면 null 반환 (에러를 던지지 않음)
      return null;
    }
    
    console.log('파일 읽기 시작...');
    const buffer = await fsPromises.readFile(normalizedPath);
    console.log('파일 읽기 완료, 버퍼 크기:', buffer.length);
    
    // JSON 파일인 경우 문자열로 변환
    if (normalizedPath.endsWith('.json')) {
      console.log('JSON 파일로 처리');
      return buffer.toString('utf8');
    }
    
    // 이미지 파일인 경우 Buffer 그대로 반환
    console.log('이미지 파일로 처리');
    return buffer;
  } catch (error) {
    console.error('=== read-file 에러 발생 ===');
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    
    // ENOENT 오류(파일 없음)는 null 반환, 다른 오류는 에러 던지기
    if (error.code === 'ENOENT') {
      console.log('ENOENT 오류로 null 반환');
      return null;
    }
    throw new Error(`Cannot read file: ${error.message}`);
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    console.log('=== delete-file 핸들러 시작 ===');
    console.log('삭제할 파일 경로:', filePath);
    
    // 파일 존재 여부 확인
    try {
      await fsPromises.access(filePath);
      console.log('파일 존재 확인됨');
    } catch (accessError) {
      console.log('파일이 이미 존재하지 않음:', accessError.message);
      return {
        success: true,
        message: '파일이 이미 존재하지 않습니다.'
      };
    }
    
    // 파일 삭제 (fsPromises.unlink 사용)
    console.log('파일 삭제 시작...');
    await fsPromises.unlink(filePath);
    console.log('파일 삭제 완료');
    
    return {
      success: true,
      message: '파일이 성공적으로 삭제되었습니다.'
    };
  } catch (error) {
    console.error('파일 삭제 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// 파일명 변경 핸들러
ipcMain.handle('rename-file', async (event, ...args) => {
  const [oldFilePath, newFilePath] = args;
  try {
    console.log('=== rename-file 핸들러 시작 ===');
    console.log('기존 파일 경로:', oldFilePath);
    console.log('새 파일 경로:', newFilePath);
    
    // 기존 파일 존재 여부 확인
    try {
      await fsPromises.access(oldFilePath);
      console.log('기존 파일 존재 확인됨');
    } catch (accessError) {
      console.log('기존 파일이 존재하지 않음:', accessError.message);
      return {
        success: false,
        error: '기존 파일을 찾을 수 없습니다.'
      };
    }
    
    // 새 파일이 이미 존재하는지 확인
    try {
      await fsPromises.access(newFilePath);
      console.log('새 파일이 이미 존재함');
      return {
        success: false,
        error: '새로운 파일명이 이미 존재합니다.'
      };
    } catch (accessError) {
      console.log('새 파일명 사용 가능');
    }
    
    // 파일명 변경
    console.log('파일명 변경 시작...');
    await fsPromises.rename(oldFilePath, newFilePath);
    console.log('파일명 변경 완료');
    
    return {
      success: true,
      message: '파일명이 성공적으로 변경되었습니다.'
    };
  } catch (error) {
    console.error('파일명 변경 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// PDF 저장 핸들러
ipcMain.handle('save-pdf', async (event, pdfData) => {
  try {
    console.log('=== PDF 저장 핸들러 시작 ===');
    const { pdfData: pdfUint8Array, filePath } = pdfData;
    console.log('저장 경로:', filePath);
    console.log('PDF 데이터 크기:', pdfUint8Array.length);
    
    // 파일 존재 여부 확인
    if (fs.existsSync(filePath)) {
      console.log('기존 파일 발견, 덮어쓰기 확인 다이얼로그 표시');
      const fileName = path.basename(filePath);
      const message = `파일 "${fileName}"이(가) 이미 존재합니다.\n\n덮어쓰시겠습니까?`;
      
      // 메인 프로세스에서 다이얼로그 표시
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox({
        type: 'question',
        buttons: ['덮어쓰기', '취소'],
        defaultId: 0,
        cancelId: 1,
        message: '파일 덮어쓰기 확인',
        detail: message
      });
      
      if (result.response === 1) { // 취소 선택
        console.log('사용자가 덮어쓰기를 취소함');
        return {
          success: false,
          cancelled: true,
          message: 'PDF 저장이 취소되었습니다.'
        };
      }
      console.log('사용자가 덮어쓰기를 선택함');
    }
    
    // 디렉토리 생성
    console.log('디렉토리 생성 중...');
    const dirPath = path.dirname(filePath);
    await ensureDirectoryExists(dirPath);
    console.log('디렉토리 생성 완료:', dirPath);
    
    // PDF 파일 저장
    console.log('PDF 파일 저장 중...');
    const buffer = Buffer.from(pdfUint8Array);
    await fsPromises.writeFile(filePath, buffer);
    console.log('PDF 파일 저장 완료:', filePath);
    
    return {
      success: true,
      message: `PDF가 성공적으로 저장되었습니다: ${path.basename(filePath)}`,
      filePath: filePath
    };
  } catch (error) {
    console.error('PDF 저장 실패:', error);
    console.error('에러 스택:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
});


// 파일 열기 핸들러
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    
    console.log('파일 열기 요청:', filePath);
    
    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      console.error('파일이 존재하지 않습니다:', filePath);
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${filePath}`
      };
    }
    
    console.log('파일 존재 확인됨, 열기 시도 중...');
    
    // macOS에서 더 안정적인 파일 열기
    if (process.platform === 'darwin') {
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec(`open "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('open 명령어 실패:', error);
            reject(error);
          } else {
            console.log('open 명령어 성공');
            resolve();
          }
        });
      });
    } else {
      await shell.openPath(filePath);
    }
    
    console.log('파일 열기 성공');
    
    return {
      success: true,
      message: `파일을 열었습니다: ${path.basename(filePath)}`
    };
  } catch (error) {
    console.error('파일 열기 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// PDF를 JPG로 변환하는 IPC 핸들러
ipcMain.handle('convert-pdf-to-jpg', async (event, uint8Array, fileName) => {
  try {
    console.log('PDF 변환 요청:', fileName);
    console.log('Uint8Array 타입:', typeof uint8Array, '길이:', uint8Array.length);
    
    // Uint8Array를 Buffer로 변환
    const buffer = Buffer.from(uint8Array);
    console.log('Buffer 변환 완료, 길이:', buffer.length);
    
    // 임시 PDF 파일 생성
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
    
    // PDF 파일 저장
    await fsPromises.writeFile(tempPdfPath, buffer);
    console.log('임시 PDF 파일 생성:', tempPdfPath);
    
    // pdf-poppler를 사용하여 PDF를 JPG로 변환 (고해상도)
    const pdfPoppler = require('pdf-poppler');
    
    const options = {
      format: 'jpeg',
      out_dir: tempDir,
      out_prefix: 'converted',
      page: 1, // 첫 번째 페이지만 변환
      // 고해상도 설정
      scale: 2.0, // 2배 해상도
      // 품질 설정
      quality: 100
    };
    
    console.log('PDF 변환 시작...');
    const result = await pdfPoppler.convert(tempPdfPath, options);
    console.log('PDF 변환 결과:', result);
    
    // 변환된 파일 찾기
    const files = await fsPromises.readdir(tempDir);
    const jpgFile = files.find(file => file.startsWith('converted') && file.endsWith('.jpg'));
    
    if (!jpgFile) {
      throw new Error('PDF 변환된 JPG 파일을 찾을 수 없습니다.');
    }
    
    const convertedJpgPath = path.join(tempDir, jpgFile);
    
    // Sharp를 사용하여 레터 사이즈에 맞게 리사이즈 및 품질 향상
    const sharp = require('sharp');
    
    console.log('Sharp를 사용하여 이미지 최적화 시작...');
    const optimizedJpgBuffer = await sharp(convertedJpgPath)
      .resize(2550, 3300, { // 레터 사이즈 (8.5 x 11 인치 @ 300 DPI)
        fit: 'contain', // 비율 유지하면서 컨테이너에 맞춤
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // 흰색 배경
        position: 'center' // 중앙 정렬
      })
      .jpeg({ 
        quality: 95, // 고품질
        progressive: true, // 프로그레시브 JPEG
        mozjpeg: true // mozjpeg 엔진 사용 (더 나은 압축)
      })
      .toBuffer();
    
    console.log('이미지 최적화 완료, 최종 크기:', optimizedJpgBuffer.length, 'bytes');
    
    // 임시 파일들 정리
    await fsPromises.unlink(tempPdfPath);
    await fsPromises.unlink(convertedJpgPath);
    
    console.log('PDF 변환 성공:', fileName, '크기:', optimizedJpgBuffer.length, 'bytes');
    
    return {
      success: true,
      file: optimizedJpgBuffer,
      fileName: fileName,
      fileSize: optimizedJpgBuffer.length
    };
    
  } catch (error) {
    console.error('PDF 변환 실패:', error);
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
