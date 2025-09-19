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

// Music_Sheets 경로 찾기 함수
const findMusicSheetsPath = () => {
  const oneDrivePath = findOneDrivePath();
  return path.join(oneDrivePath, 'WorshipNote_Data', 'Music_Sheets');
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

// 사용자 입력을 받는 함수
const askUserConfirmation = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
};

// 메인 실행 함수
const main = async () => {
  try {
    console.log('=== 기존 악보 파일명 일괄 변경 스크립트 ===\n');
    
    // 1. 경로 설정
    const oneDrivePath = findOneDrivePath();
    const musicSheetsPath = findMusicSheetsPath();
    const songsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'songs.json');
    const worshipListsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'worship_lists.json');
    
    console.log('OneDrive 경로:', oneDrivePath);
    console.log('Music_Sheets 경로:', musicSheetsPath);
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
    
    if (!fs.existsSync(musicSheetsPath)) {
      console.error('❌ Music_Sheets 폴더를 찾을 수 없습니다:', musicSheetsPath);
      return;
    }
    
    // 3. 데이터베이스 로드
    console.log('📖 데이터베이스 로드 중...');
    const songsData = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
    const worshipListsData = JSON.parse(fs.readFileSync(worshipListsPath, 'utf8'));
    
    console.log(`✅ Songs 데이터베이스 로드 완료: ${songsData.songs.length}개 곡`);
    console.log(`✅ Worship Lists 데이터베이스 로드 완료: ${Object.keys(worshipListsData).length}개 리스트\n`);
    
    // 4. 변경 가능한 파일들 분석
    console.log('🔍 변경 가능한 파일들 분석 중...\n');
    
    const changes = [];
    let totalFiles = 0;
    let filesWithNewNames = 0;
    
    for (const song of songsData.songs) {
      if (song.fileName && song.fileName.trim() !== '') {
        totalFiles++;
        
        const newFileName = generateNewFileName(song);
        if (newFileName && newFileName !== song.fileName) {
          const oldPath = path.join(musicSheetsPath, song.fileName);
          const newPath = path.join(musicSheetsPath, newFileName);
          
          // 파일이 실제로 존재하는지 확인
          if (fs.existsSync(oldPath)) {
            changes.push({
              song: song,
              oldFileName: song.fileName,
              newFileName: newFileName,
              oldPath: oldPath,
              newPath: newPath
            });
            filesWithNewNames++;
          } else {
            console.log(`⚠️  파일이 존재하지 않음: ${song.fileName} (${song.title})`);
          }
        }
      }
    }
    
    // 5. 결과 요약 출력
    console.log('📊 분석 결과:');
    console.log(`   전체 악보 파일: ${totalFiles}개`);
    console.log(`   변경 가능한 파일: ${filesWithNewNames}개`);
    console.log(`   변경 불필요한 파일: ${totalFiles - filesWithNewNames}개\n`);
    
    if (filesWithNewNames === 0) {
      console.log('✅ 모든 파일이 이미 올바른 형식입니다. 변경할 파일이 없습니다.');
      return;
    }
    
    // 6. 변경될 파일들 미리보기 (처음 10개만)
    console.log('📋 변경될 파일들 미리보기 (처음 10개):');
    changes.slice(0, 10).forEach((change, index) => {
      console.log(`   ${index + 1}. ${change.song.title}`);
      console.log(`      기존: ${change.oldFileName}`);
      console.log(`      신규: ${change.newFileName}\n`);
    });
    
    if (changes.length > 10) {
      console.log(`   ... 및 ${changes.length - 10}개 더\n`);
    }
    
    // 7. 사용자 확인
    console.log(`⚠️  주의: ${filesWithNewNames}개의 파일이 변경됩니다.`);
    console.log('   이 작업은 되돌릴 수 없습니다. 백업을 권장합니다.\n');
    
    const answer = await askUserConfirmation('계속 진행하시겠습니까? (y/N): ');
    
    if (answer !== 'y' && answer !== 'yes') {
      console.log('❌ 작업이 취소되었습니다.');
      return;
    }
    
    // 8. 백업 생성
    console.log('\n💾 백업 생성 중...');
    const backupDir = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'backup_' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(backupDir, { recursive: true });
    
    fs.copyFileSync(songsPath, path.join(backupDir, 'songs.json'));
    fs.copyFileSync(worshipListsPath, path.join(backupDir, 'worship_lists.json'));
    
    console.log(`✅ 백업 생성 완료: ${backupDir}\n`);
    
    // 9. 파일명 변경 실행
    console.log('🔄 파일명 변경 시작...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      
      try {
        // 파일 이름 변경
        fs.renameSync(change.oldPath, change.newPath);
        
        // 데이터베이스에서 파일명 업데이트
        change.song.fileName = change.newFileName;
        
        console.log(`✅ ${i + 1}/${changes.length}: ${change.song.title}`);
        console.log(`   ${change.oldFileName} → ${change.newFileName}`);
        
        successCount++;
      } catch (error) {
        console.error(`❌ ${i + 1}/${changes.length}: ${change.song.title} - ${error.message}`);
        errorCount++;
      }
    }
    
    // 10. Worship Lists에서도 파일명 업데이트
    console.log('\n🔄 Worship Lists 데이터베이스 업데이트 중...');
    
    let worshipListsUpdated = 0;
    Object.keys(worshipListsData).forEach(dateKey => {
      // lastUpdated 필드가 아닌 경우에만 처리
      if (dateKey !== 'lastUpdated' && Array.isArray(worshipListsData[dateKey])) {
        let hasChanges = false;
        worshipListsData[dateKey] = worshipListsData[dateKey].map(song => {
          const updatedSong = changes.find(change => change.song.id === song.id);
          if (updatedSong) {
            hasChanges = true;
            return { ...song, fileName: updatedSong.newFileName };
          }
          return song;
        });
        
        if (hasChanges) {
          worshipListsUpdated++;
        }
      }
    });
    
    console.log(`✅ ${worshipListsUpdated}개 Worship List 업데이트 완료`);
    
    // 11. 업데이트된 데이터베이스 저장
    console.log('\n💾 데이터베이스 저장 중...');
    
    fs.writeFileSync(songsPath, JSON.stringify(songsData, null, 2), 'utf8');
    fs.writeFileSync(worshipListsPath, JSON.stringify(worshipListsData, null, 2), 'utf8');
    
    console.log('✅ 데이터베이스 저장 완료');
    
    // 12. 최종 결과
    console.log('\n🎉 작업 완료!');
    console.log(`   성공: ${successCount}개 파일`);
    console.log(`   실패: ${errorCount}개 파일`);
    console.log(`   백업 위치: ${backupDir}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  일부 파일에서 오류가 발생했습니다. 로그를 확인해주세요.');
    }
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  }
};

// 스크립트 실행
main();
