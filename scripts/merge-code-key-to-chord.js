const fs = require('fs');
const path = require('path');
const os = require('os');

// OneDrive 경로 찾기 함수
const findOneDrivePath = () => {
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(homeDir, 'OneDrive'),
    path.join(homeDir, 'OneDrive - Personal'),
    path.join(homeDir, 'OneDrive - 회사명'),
    path.join(homeDir, 'OneDrive - Company'),
  ];

  for (const oneDrivePath of possiblePaths) {
    if (fs.existsSync(oneDrivePath)) {
      return oneDrivePath;
    }
  }
  return null;
};

async function mergeCodeKeyToChord() {
  try {
    console.log('🔄 code와 key 필드를 chord로 통합 시작...');
    
    // OneDrive 경로 찾기
    const oneDrivePath = findOneDrivePath();
    if (!oneDrivePath) {
      console.error('❌ OneDrive 경로를 찾을 수 없습니다.');
      return;
    }
    
    console.log(`📁 OneDrive 경로: ${oneDrivePath}`);
    
    const dataDirPath = path.join(oneDrivePath, 'WorshipNote_Data', 'Database');
    const songsFilePath = path.join(dataDirPath, 'songs.json');
    const worshipListsFilePath = path.join(dataDirPath, 'worship_lists.json');
    
    // 백업 생성
    const backupDir = path.join(dataDirPath, 'Backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSongsPath = path.join(backupDir, `songs_backup_${timestamp}.json`);
    const backupWorshipListsPath = path.join(backupDir, `worship_lists_backup_${timestamp}.json`);
    
    // songs.json 처리
    if (fs.existsSync(songsFilePath)) {
      console.log('📊 songs.json 처리 중...');
      const songsData = JSON.parse(fs.readFileSync(songsFilePath, 'utf8'));
      
      // 백업 생성
      fs.writeFileSync(backupSongsPath, JSON.stringify(songsData, null, 2));
      console.log(`💾 songs.json 백업 생성: ${backupSongsPath}`);
      
      // code와 key를 chord로 통합
      let updatedCount = 0;
      songsData.songs = songsData.songs.map(song => {
        const chord = song.code || song.key || '';
        const updatedSong = { ...song };
        
        // chord 필드 추가
        updatedSong.chord = chord;
        
        // code와 key 필드 제거
        delete updatedSong.code;
        delete updatedSong.key;
        
        if (song.code || song.key) {
          updatedCount++;
        }
        
        return updatedSong;
      });
      
      // 업데이트된 songs.json 저장
      fs.writeFileSync(songsFilePath, JSON.stringify(songsData, null, 2));
      console.log(`✅ songs.json 업데이트 완료: ${updatedCount}개 찬양 처리`);
    }
    
    // worship_lists.json 처리
    if (fs.existsSync(worshipListsFilePath)) {
      console.log('📅 worship_lists.json 처리 중...');
      const worshipListsData = JSON.parse(fs.readFileSync(worshipListsFilePath, 'utf8'));
      
      // 백업 생성
      fs.writeFileSync(backupWorshipListsPath, JSON.stringify(worshipListsData, null, 2));
      console.log(`💾 worship_lists.json 백업 생성: ${backupWorshipListsPath}`);
      
      // 각 찬양 리스트의 찬양들 처리
      let totalUpdated = 0;
      Object.keys(worshipListsData.worshipLists).forEach(dateKey => {
        if (worshipListsData.worshipLists[dateKey]) {
          worshipListsData.worshipLists[dateKey] = worshipListsData.worshipLists[dateKey].map(song => {
            const chord = song.code || song.key || '';
            const updatedSong = { ...song };
            
            // chord 필드 추가
            updatedSong.chord = chord;
            
            // code와 key 필드 제거
            delete updatedSong.code;
            delete updatedSong.key;
            
            if (song.code || song.key) {
              totalUpdated++;
            }
            
            return updatedSong;
          });
        }
      });
      
      // 업데이트된 worship_lists.json 저장
      fs.writeFileSync(worshipListsFilePath, JSON.stringify(worshipListsData, null, 2));
      console.log(`✅ worship_lists.json 업데이트 완료: ${totalUpdated}개 찬양 처리`);
    }
    
    // public/data.json도 업데이트
    const publicDataPath = path.join(__dirname, '..', 'public', 'data.json');
    if (fs.existsSync(publicDataPath)) {
      console.log('🌐 public/data.json 처리 중...');
      const publicData = JSON.parse(fs.readFileSync(publicDataPath, 'utf8'));
      
      // songs 처리
      if (publicData.songs) {
        publicData.songs = publicData.songs.map(song => {
          const chord = song.code || song.key || '';
          const updatedSong = { ...song };
          updatedSong.chord = chord;
          delete updatedSong.code;
          delete updatedSong.key;
          return updatedSong;
        });
      }
      
      // worshipLists 처리
      if (publicData.worshipLists) {
        Object.keys(publicData.worshipLists).forEach(dateKey => {
          if (publicData.worshipLists[dateKey]) {
            publicData.worshipLists[dateKey] = publicData.worshipLists[dateKey].map(song => {
              const chord = song.code || song.key || '';
              const updatedSong = { ...song };
              updatedSong.chord = chord;
              delete updatedSong.code;
              delete updatedSong.key;
              return updatedSong;
            });
          }
        });
      }
      
      fs.writeFileSync(publicDataPath, JSON.stringify(publicData, null, 2));
      console.log('✅ public/data.json 업데이트 완료');
    }
    
    console.log('🎉 code와 key 필드를 chord로 통합 완료!');
    console.log('📋 변경 사항:');
    console.log('   - code 필드 → chord 필드로 통합');
    console.log('   - key 필드 → chord 필드로 통합');
    console.log('   - 백업 파일 생성됨');
    console.log('   - OneDrive와 public/data.json 모두 업데이트됨');
    
  } catch (error) {
    console.error('❌ 필드 통합 실패:', error);
  }
}

// 스크립트 실행
mergeCodeKeyToChord();
