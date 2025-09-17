const fs = require('fs');
const path = require('path');

/**
 * data.json의 모든 악보에 올바른 filePath 설정
 */
function fixFilePaths() {
  try {
    // data.json 파일 읽기
    const dataPath = path.join(__dirname, '..', 'public', 'data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log('=== 악보 파일 경로 수정 시작 ===');
    console.log(`총 ${data.songs.length}개의 악보를 처리합니다.`);
    
    let fixedCount = 0;
    
    // 각 악보의 filePath 수정
    data.songs.forEach((song, index) => {
      if (song.fileName && !song.filePath) {
        // macOS 경로로 설정 (앱에서 변환할 때 사용)
        song.filePath = `/Users/brian/Library/CloudStorage/OneDrive-Personal/WorshipNote_Data/Music_Sheets/${song.fileName}`;
        fixedCount++;
        
        if (index < 10) { // 처음 10개만 로그 출력
          console.log(`수정됨: ${song.title} -> ${song.fileName}`);
        }
      }
    });
    
    // 수정된 데이터를 파일에 저장
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    
    console.log(`\n=== 수정 완료 ===`);
    console.log(`${fixedCount}개의 악보 파일 경로가 수정되었습니다.`);
    console.log('이제 앱에서 악보를 정상적으로 찾을 수 있습니다.');
    
  } catch (error) {
    console.error('파일 경로 수정 실패:', error.message);
  }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  fixFilePaths();
}

module.exports = fixFilePaths;
