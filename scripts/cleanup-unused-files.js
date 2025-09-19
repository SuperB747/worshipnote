const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

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
  
  throw new Error('OneDrive 경로를 찾을 수 없습니다.');
};

// 사용자 입력을 받기 위한 readline 인터페이스
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function cleanupUnusedFiles() {
  try {
    console.log('🧹 데이터베이스와 연동되지 않은 파일 정리 시작...\n');
    
    // OneDrive 경로 찾기
    const oneDrivePath = findOneDrivePath();
    console.log('📁 OneDrive 경로:', oneDrivePath);
    
    const songsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'songs.json');
    const worshipListsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'worship_lists.json');
    const musicSheetsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Music_Sheets');
    
    // 1. Songs 데이터베이스 로드
    console.log('📖 Songs 데이터베이스 로드 중...');
    const songsData = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
    const songsArray = songsData.songs || songsData;
    console.log(`✅ ${songsArray.length}개 찬양 로드 완료`);
    
    // 2. Worship Lists 데이터베이스 로드
    console.log('📖 Worship Lists 데이터베이스 로드 중...');
    const worshipListsData = JSON.parse(fs.readFileSync(worshipListsPath, 'utf8'));
    const worshipLists = worshipListsData.worshipLists || worshipListsData;
    console.log(`✅ ${Object.keys(worshipLists).length - 1}개 찬양 리스트 로드 완료`);
    
    // 3. 데이터베이스에서 사용 중인 파일명 수집
    console.log('\n🔍 데이터베이스에서 사용 중인 파일명 수집 중...');
    const usedFileNames = new Set();
    
    // Songs 데이터베이스에서 파일명 수집
    songsArray.forEach(song => {
      if (song.fileName && song.fileName.trim() !== '') {
        usedFileNames.add(song.fileName);
      }
    });
    
    // Worship Lists에서 파일명 수집
    Object.keys(worshipLists).forEach(dateKey => {
      if (dateKey !== 'lastUpdated' && Array.isArray(worshipLists[dateKey])) {
        worshipLists[dateKey].forEach(song => {
          if (song.fileName && song.fileName.trim() !== '') {
            usedFileNames.add(song.fileName);
          }
        });
      }
    });
    
    console.log(`✅ 사용 중인 파일명: ${usedFileNames.size}개`);
    
    // 4. Music_Sheets 폴더의 실제 파일들 확인
    console.log('\n📂 Music_Sheets 폴더 스캔 중...');
    
    if (!fs.existsSync(musicSheetsPath)) {
      console.log('❌ Music_Sheets 폴더가 존재하지 않습니다.');
      return;
    }
    
    const actualFiles = fs.readdirSync(musicSheetsPath);
    console.log(`✅ 실제 파일 개수: ${actualFiles.length}개`);
    
    // 5. 사용되지 않는 파일 찾기
    console.log('\n🔍 사용되지 않는 파일 분석 중...');
    
    const unusedFiles = [];
    const usedFiles = [];
    
    actualFiles.forEach(fileName => {
      if (usedFileNames.has(fileName)) {
        usedFiles.push(fileName);
      } else {
        unusedFiles.push(fileName);
      }
    });
    
    console.log(`📊 분석 결과:`);
    console.log(`  - 사용 중인 파일: ${usedFiles.length}개`);
    console.log(`  - 사용되지 않는 파일: ${unusedFiles.length}개`);
    
    if (unusedFiles.length === 0) {
      console.log('\n🎉 모든 파일이 데이터베이스와 연동되어 있습니다!');
      rl.close();
      return;
    }
    
    // 6. 사용되지 않는 파일 목록 표시
    console.log('\n📋 사용되지 않는 파일 목록:');
    unusedFiles.forEach((fileName, index) => {
      console.log(`  ${index + 1}. ${fileName}`);
    });
    
    // 7. 사용자 확인
    console.log(`\n⚠️  ${unusedFiles.length}개의 파일이 데이터베이스와 연동되지 않았습니다.`);
    const confirm = await question('이 파일들을 삭제하시겠습니까? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ 삭제가 취소되었습니다.');
      rl.close();
      return;
    }
    
    // 8. 백업 생성
    console.log('\n💾 백업 생성 중...');
    const backupDir = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'backup_' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(backupDir, { recursive: true });
    
    // 사용되지 않는 파일들을 백업 폴더로 이동
    const backupFilesDir = path.join(backupDir, 'unused_files');
    fs.mkdirSync(backupFilesDir, { recursive: true });
    
    console.log(`✅ 백업 폴더 생성: ${backupDir}`);
    
    // 9. 파일 삭제 (백업 후)
    console.log('\n🗑️  파일 삭제 중...');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const fileName of unusedFiles) {
      try {
        const sourcePath = path.join(musicSheetsPath, fileName);
        const backupPath = path.join(backupFilesDir, fileName);
        
        // 백업 폴더로 복사
        fs.copyFileSync(sourcePath, backupPath);
        
        // 원본 파일 삭제
        fs.unlinkSync(sourcePath);
        
        console.log(`  ✅ ${fileName} 삭제 완료`);
        deletedCount++;
      } catch (error) {
        console.log(`  ❌ ${fileName} 삭제 실패: ${error.message}`);
        errorCount++;
      }
    }
    
    // 10. 결과 출력
    console.log('\n🎉 정리 완료!');
    console.log(`📊 삭제된 파일: ${deletedCount}개`);
    console.log(`❌ 삭제 실패: ${errorCount}개`);
    console.log(`💾 백업 위치: ${backupFilesDir}`);
    
    if (deletedCount > 0) {
      console.log('\n💡 백업된 파일들은 필요시 복구할 수 있습니다.');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  } finally {
    rl.close();
  }
}

// 스크립트 실행
cleanupUnusedFiles();
