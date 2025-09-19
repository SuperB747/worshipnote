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
  
  throw new Error('OneDrive 경로를 찾을 수 없습니다.');
};

async function syncWorshipListsFilenames() {
  try {
    console.log('🔄 찬양 리스트 파일명 동기화 시작...\n');
    
    // OneDrive 경로 찾기
    const oneDrivePath = findOneDrivePath();
    console.log('📁 OneDrive 경로:', oneDrivePath);
    
    const songsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'songs.json');
    const worshipListsPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'worship_lists.json');
    
    // 1. Songs 데이터베이스 로드
    console.log('📖 Songs 데이터베이스 로드 중...');
    const songsData = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
    const songsArray = songsData.songs || songsData; // songs 배열 추출
    console.log(`✅ ${songsArray.length}개 찬양 로드 완료`);
    
    // 2. Worship Lists 데이터베이스 로드
    console.log('📖 Worship Lists 데이터베이스 로드 중...');
    const worshipListsData = JSON.parse(fs.readFileSync(worshipListsPath, 'utf8'));
    const worshipLists = worshipListsData.worshipLists || worshipListsData; // worshipLists 객체 추출
    console.log(`✅ ${Object.keys(worshipLists).length - 1}개 찬양 리스트 로드 완료`); // lastUpdated 제외
    
    // 3. Songs 데이터를 ID로 매핑
    const songsById = {};
    songsArray.forEach(song => {
      songsById[song.id] = song;
    });
    
    // 4. Worship Lists에서 파일명 동기화
    console.log('\n🔄 찬양 리스트 파일명 동기화 중...');
    console.log('찬양 리스트 키들:', Object.keys(worshipLists));
    
    let totalUpdated = 0;
    let listsProcessed = 0;
    
    Object.keys(worshipLists).forEach(dateKey => {
      console.log(`처리 중인 키: ${dateKey}, 타입: ${typeof worshipLists[dateKey]}, 배열인가: ${Array.isArray(worshipLists[dateKey])}`);
      
      // lastUpdated 필드가 아닌 경우에만 처리
      if (dateKey !== 'lastUpdated' && Array.isArray(worshipLists[dateKey])) {
        listsProcessed++;
        let listUpdated = 0;
        console.log(`${dateKey} 리스트 처리 중... (${worshipLists[dateKey].length}개 곡)`);
        
        worshipLists[dateKey] = worshipLists[dateKey].map(song => {
          // 메인 데이터베이스에서 해당 ID의 최신 정보 찾기
          const latestSong = songsById[song.id];
          
          if (latestSong && latestSong.fileName !== song.fileName) {
            console.log(`  📝 ${song.title}: "${song.fileName}" → "${latestSong.fileName}"`);
            listUpdated++;
            totalUpdated++;
            
            return {
              ...song,
              fileName: latestSong.fileName,
              title: latestSong.title, // 제목도 동기화
              key: latestSong.key || latestSong.code, // key/code 통일
              code: latestSong.code || latestSong.key,
              tempo: latestSong.tempo,
              firstLyrics: latestSong.firstLyrics
            };
          }
          
          return song;
        });
        
        if (listUpdated > 0) {
          console.log(`  ✅ ${dateKey}: ${listUpdated}개 파일명 업데이트`);
        }
      }
    });
    
    // 5. 백업 생성
    console.log('\n💾 백업 생성 중...');
    const backupDir = path.join(oneDrivePath, 'WorshipNote_Data', 'Database', 'backup_' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(backupDir, { recursive: true });
    
    fs.copyFileSync(worshipListsPath, path.join(backupDir, 'worship_lists.json'));
    console.log(`✅ 백업 생성: ${backupDir}`);
    
    // 6. 업데이트된 데이터 저장
    console.log('\n💾 Worship Lists 데이터베이스 저장 중...');
    const updatedWorshipListsData = {
      ...worshipListsData,
      worshipLists: worshipLists
    };
    fs.writeFileSync(worshipListsPath, JSON.stringify(updatedWorshipListsData, null, 2), 'utf8');
    
    // 7. 결과 출력
    console.log('\n🎉 동기화 완료!');
    console.log(`📊 처리된 찬양 리스트: ${listsProcessed}개`);
    console.log(`📝 업데이트된 파일명: ${totalUpdated}개`);
    console.log(`💾 백업 위치: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  }
}

// 스크립트 실행
syncWorshipListsFilenames();
