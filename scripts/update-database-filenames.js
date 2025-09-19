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
    try {
      if (fs.existsSync(oneDrivePath)) {
        return oneDrivePath;
      }
    } catch (error) {
      continue;
    }
  }
  
  return path.join(homeDir, 'Documents', 'WorshipNote_Data');
};

// 새 파일명 생성 함수
const generateNewFileName = (song) => {
  if (!song.id || !song.title) {
    return null;
  }
  
  // 찬양 제목에서 1/2, 2/2 같은 패턴을 처리
  let cleanedTitle = song.title;
  const slashPattern = /^(.*?)\s*(\d+)\/\d+$/;
  const slashMatch = song.title.match(slashPattern);
  if (slashMatch) {
    cleanedTitle = `${slashMatch[1].trim()} ${slashMatch[2]}`;
  }
  
  // 파일명에 사용할 수 없는 문자만 하이픈으로 변환 (공백 유지)
  const safeTitle = cleanedTitle.replace(/[<>:"/\\|?*]/g, '-').trim();
  const safeKey = (song.key || song.code || '').replace(/[<>:"/\\|?*]/g, '-').trim();
  
  // 형식: "찬양 제목 (코드) (ID).jpg"
  let fileName = safeTitle;
  if (safeKey) {
    fileName += ` (${safeKey})`;
  }
  if (song.id) {
    fileName += ` (${song.id})`;
  }
  return `${fileName}.jpg`;
};

// 메인 실행 함수
const main = async () => {
  try {
    console.log('=== 데이터베이스 파일명 업데이트 스크립트 ===\n');
    
    // 1. 경로 설정
    const oneDrivePath = findOneDrivePath();
    const songsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'songs.json');
    const worshipListsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'worship_lists.json');
    
    console.log('OneDrive 경로:', oneDrivePath);
    console.log('Songs 데이터베이스:', songsPath);
    console.log('Worship Lists 데이터베이스:', worshipListsPath);
    console.log('');
    
    // 2. 데이터베이스 파일 존재 확인
    if (!fs.existsSync(songsPath)) {
      console.error('❌ songs.json 파일을 찾을 수 없습니다:', songsPath);
      return;
    }
    
    if (!fs.existsSync(worshipListsPath)) {
      console.error('❌ worship_lists.json 파일을 찾을 수 없습니다:', worshipListsPath);
      return;
    }
    
    // 3. 데이터베이스 로드
    console.log('📖 데이터베이스 로드 중...');
    const songsData = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
    const worshipListsData = JSON.parse(fs.readFileSync(worshipListsPath, 'utf8'));
    
    console.log(`✅ Songs 데이터베이스 로드 완료: ${songsData.songs.length}개 곡`);
    console.log(`✅ Worship Lists 데이터베이스 로드 완료: ${Object.keys(worshipListsData).length}개 리스트\n`);
    
    // 4. 백업 생성
    console.log('💾 백업 생성 중...');
    const backupDir = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'backup_' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(backupDir, { recursive: true });
    
    fs.copyFileSync(songsPath, path.join(backupDir, 'songs.json'));
    fs.copyFileSync(worshipListsPath, path.join(backupDir, 'worship_lists.json'));
    
    console.log(`✅ 백업 생성 완료: ${backupDir}\n`);
    
    // 5. Songs 데이터베이스 업데이트
    console.log('🔄 Songs 데이터베이스 업데이트 중...');
    
    let songsUpdated = 0;
    for (const song of songsData.songs) {
      if (song.fileName && song.fileName.trim() !== '') {
        const newFileName = generateNewFileName(song);
        if (newFileName && newFileName !== song.fileName) {
          console.log(`   ${song.title}: ${song.fileName} → ${newFileName}`);
          song.fileName = newFileName;
          songsUpdated++;
        }
      }
    }
    
    console.log(`✅ ${songsUpdated}개 Songs 업데이트 완료\n`);
    
    // 6. Worship Lists 데이터베이스 업데이트
    console.log('🔄 Worship Lists 데이터베이스 업데이트 중...');
    
    let worshipListsUpdated = 0;
    Object.keys(worshipListsData).forEach(dateKey => {
      // lastUpdated 필드가 아닌 경우에만 처리
      if (dateKey !== 'lastUpdated' && Array.isArray(worshipListsData[dateKey])) {
        let hasChanges = false;
        worshipListsData[dateKey] = worshipListsData[dateKey].map(song => {
          const newFileName = generateNewFileName(song);
          if (newFileName && newFileName !== song.fileName) {
            hasChanges = true;
            return { ...song, fileName: newFileName };
          }
          return song;
        });
        
        if (hasChanges) {
          worshipListsUpdated++;
        }
      }
    });
    
    console.log(`✅ ${worshipListsUpdated}개 Worship List 업데이트 완료\n`);
    
    // 7. 업데이트된 데이터베이스 저장
    console.log('💾 데이터베이스 저장 중...');
    
    fs.writeFileSync(songsPath, JSON.stringify(songsData, null, 2), 'utf8');
    fs.writeFileSync(worshipListsPath, JSON.stringify(worshipListsData, null, 2), 'utf8');
    
    console.log('✅ 데이터베이스 저장 완료');
    
    // 8. 최종 결과
    console.log('\n🎉 작업 완료!');
    console.log(`   Songs 업데이트: ${songsUpdated}개`);
    console.log(`   Worship Lists 업데이트: ${worshipListsUpdated}개`);
    console.log(`   백업 위치: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  }
};

// 스크립트 실행
main();
