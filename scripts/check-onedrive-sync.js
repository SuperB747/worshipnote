const fs = require('fs');
const path = require('path');
const os = require('os');

// OneDrive 경로 찾기 함수
const findOneDrivePath = () => {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  let possiblePaths = [];
  
  if (platform === 'darwin') {
    possiblePaths = [
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-Personal'),
      path.join(homeDir, 'Library', 'CloudStorage', 'OneDrive-회사명'),
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'Documents')
    ];
  } else if (platform === 'win32') {
    possiblePaths = [
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'OneDrive - Personal'),
      path.join(homeDir, 'OneDrive - 회사명'),
      path.join(homeDir, 'Documents')
    ];
  } else {
    possiblePaths = [
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'Documents')
    ];
  }
  
  for (const oneDrivePath of possiblePaths) {
    if (fs.existsSync(oneDrivePath)) {
      const worshipNotePath = path.join(oneDrivePath, 'WorshipNote_Data');
      if (fs.existsSync(worshipNotePath)) {
        return oneDrivePath;
      }
    }
  }
  
  return null;
};

// OneDrive 파일 동기화 상태 확인 함수
const checkOneDriveSyncStatus = async (filePath) => {
  try {
    // 파일이 OneDrive 경로에 있는지 확인
    if (!filePath.includes('OneDrive') && !filePath.includes('CloudStorage')) {
      return { isOneDrive: false, isSynced: true };
    }
    
    // 파일 존재 여부를 빠르게 확인 (타임아웃 3초)
    const exists = await Promise.race([
      fs.promises.access(filePath).then(() => true).catch(() => false),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]).catch(() => false);
    
    if (!exists) {
      return { isOneDrive: true, isSynced: false };
    }
    
    // 파일 크기 확인 (0바이트면 동기화되지 않음)
    const stats = await fs.promises.stat(filePath);
    const isSynced = stats.size > 0;
    
    return { isOneDrive: true, isSynced };
  } catch (error) {
    return { isOneDrive: true, isSynced: false };
  }
};

async function checkOneDriveSync() {
  try {
    console.log('🔍 OneDrive 동기화 상태 확인 중...\n');
    
    // OneDrive 경로 찾기
    const oneDrivePath = findOneDrivePath();
    if (!oneDrivePath) {
      console.error('❌ OneDrive 경로를 찾을 수 없습니다.');
      return;
    }
    
    console.log(`📁 OneDrive 경로: ${oneDrivePath}`);
    
    const musicSheetsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Music_Sheets');
    if (!fs.existsSync(musicSheetsPath)) {
      console.error('❌ Music_Sheets 폴더를 찾을 수 없습니다.');
      return;
    }
    
    console.log(`📂 Music_Sheets 경로: ${musicSheetsPath}\n`);
    
    // 파일 목록 가져오기
    const files = fs.readdirSync(musicSheetsPath);
    const imageFiles = files.filter(file => 
      file.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)
    );
    
    console.log(`📊 총 ${imageFiles.length}개의 이미지 파일 발견\n`);
    
    // 각 파일의 동기화 상태 확인
    let syncedCount = 0;
    let unsyncedCount = 0;
    const unsyncedFiles = [];
    
    for (const fileName of imageFiles) {
      const filePath = path.join(musicSheetsPath, fileName);
      const syncStatus = await checkOneDriveSyncStatus(filePath);
      
      if (syncStatus.isOneDrive) {
        if (syncStatus.isSynced) {
          syncedCount++;
          console.log(`✅ ${fileName} - 동기화됨`);
        } else {
          unsyncedCount++;
          unsyncedFiles.push(fileName);
          console.log(`❌ ${fileName} - 동기화되지 않음`);
        }
      } else {
        syncedCount++;
        console.log(`✅ ${fileName} - 로컬 파일`);
      }
    }
    
    console.log(`\n📊 동기화 상태 요약:`);
    console.log(`  - 동기화된 파일: ${syncedCount}개`);
    console.log(`  - 동기화되지 않은 파일: ${unsyncedCount}개`);
    
    if (unsyncedCount > 0) {
      console.log(`\n⚠️  동기화되지 않은 파일들:`);
      unsyncedFiles.forEach((fileName, index) => {
        console.log(`  ${index + 1}. ${fileName}`);
      });
      
      console.log(`\n💡 해결 방법:`);
      console.log(`  1. OneDrive 앱에서 해당 파일들을 "항상 이 기기에서 사용 가능"으로 설정`);
      console.log(`  2. 파일을 로컬 폴더로 복사`);
      console.log(`  3. OneDrive 동기화 상태 확인`);
    } else {
      console.log(`\n🎉 모든 파일이 정상적으로 동기화되어 있습니다!`);
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

// 스크립트 실행
checkOneDriveSync();
