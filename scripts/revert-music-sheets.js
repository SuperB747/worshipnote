const fs = require('fs');
const path = require('path');

// OneDrive 경로 설정
const ONEDRIVE_BASE_PATH = process.env.ONEDRIVE_PATH || 'C:\\Users\\brian\\OneDrive\\WorshipNote_Data';
const MUSIC_SHEETS_PATH = path.join(ONEDRIVE_BASE_PATH, 'Music_Sheets');
const SONGS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'songs.json');
const WORSHIP_LISTS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'worship_lists.json');

// 백업 파일 경로
const BACKUP_SONGS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'songs.json.backup');
const BACKUP_WORSHIP_LISTS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'worship_lists.json.backup');

// 새로운 파일명에서 원래 파일명을 추출하는 함수
const extractOriginalFileName = (newFileName) => {
  const withoutExt = path.parse(newFileName).name;
  
  // 패턴: "제목_코드_(ID).jpg" -> "제목 코드.jpg"
  const pattern = /^(.+)_([^_]+)_\(([^)]+)\)$/;
  const match = withoutExt.match(pattern);
  
  if (match) {
    const title = match[1].replace(/_/g, ' ');
    const key = match[2];
    const id = match[3];
    
    // 원래 파일명 형식으로 복원 (제목 + 코드)
    return `${title} ${key}.jpg`;
  }
  
  return null;
};

// 백업 파일이 있는지 확인하고 복원하는 함수
const restoreFromBackup = () => {
  console.log('🔄 백업 파일에서 복원 중...');
  
  if (fs.existsSync(BACKUP_SONGS_FILE_PATH)) {
    fs.copyFileSync(BACKUP_SONGS_FILE_PATH, SONGS_FILE_PATH);
    console.log('✅ songs.json 백업에서 복원 완료');
  } else {
    console.log('⚠️  songs.json 백업 파일이 없습니다.');
  }
  
  if (fs.existsSync(BACKUP_WORSHIP_LISTS_FILE_PATH)) {
    fs.copyFileSync(BACKUP_WORSHIP_LISTS_FILE_PATH, WORSHIP_LISTS_FILE_PATH);
    console.log('✅ worship_lists.json 백업에서 복원 완료');
  } else {
    console.log('⚠️  worship_lists.json 백업 파일이 없습니다.');
  }
};

// 메인 함수
async function revertMusicSheets() {
  try {
    console.log('🔄 악보 파일명 리버트 스크립트 시작...\n');
    
    // 1. 백업 파일에서 데이터베이스 복원
    restoreFromBackup();
    
    // 2. Music_Sheets 폴더 확인
    if (!fs.existsSync(MUSIC_SHEETS_PATH)) {
      throw new Error(`Music_Sheets 폴더를 찾을 수 없습니다: ${MUSIC_SHEETS_PATH}`);
    }
    
    const musicFiles = fs.readdirSync(MUSIC_SHEETS_PATH)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext);
      });
    
    console.log(`📁 Music_Sheets 폴더에서 ${musicFiles.length}개 파일 발견\n`);
    
    // 3. 새로운 형식의 파일명을 찾아서 원래 형식으로 변경
    let revertedCount = 0;
    const errors = [];
    
    console.log('🔄 파일명 리버트 시작...\n');
    
    for (const fileName of musicFiles) {
      try {
        console.log(`처리 중: ${fileName}`);
        
        // 새로운 형식인지 확인
        const originalFileName = extractOriginalFileName(fileName);
        
        if (!originalFileName) {
          console.log(`  ✅ 이미 원래 형식이거나 처리할 수 없는 파일입니다. 건너뜀.`);
          continue;
        }
        
        // 파일명이 이미 원래 형식인지 확인
        if (fileName === originalFileName) {
          console.log(`  ✅ 이미 원래 형식입니다. 건너뜀.`);
          continue;
        }
        
        // 파일명 변경
        const oldFilePath = path.join(MUSIC_SHEETS_PATH, fileName);
        const newFilePath = path.join(MUSIC_SHEETS_PATH, originalFileName);
        
        if (fs.existsSync(newFilePath)) {
          console.log(`  ⚠️  대상 파일이 이미 존재합니다: ${originalFileName}. 건너뜀.`);
          continue;
        }
        
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`  ✅ ${fileName} → ${originalFileName}`);
        revertedCount++;
        
      } catch (error) {
        const errorMsg = `파일 ${fileName} 처리 중 오류: ${error.message}`;
        console.log(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    // 4. 결과 요약
    console.log('\n🎉 리버트 작업 완료!');
    console.log('='.repeat(50));
    console.log(`📁 파일명 리버트: ${revertedCount}개`);
    
    if (errors.length > 0) {
      console.log(`\n❌ 오류 발생: ${errors.length}개`);
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n✨ 악보 파일명이 원래 형식으로 되돌려졌습니다!');
    console.log('💡 데이터베이스는 백업 파일에서 복원되었습니다.');
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  revertMusicSheets();
}

module.exports = { revertMusicSheets };
