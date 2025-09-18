const fs = require('fs');
const path = require('path');

// OneDrive 경로 설정
const ONEDRIVE_BASE_PATH = process.env.ONEDRIVE_PATH || 'C:\\Users\\brian\\OneDrive\\WorshipNote_Data';
const MUSIC_SHEETS_PATH = path.join(ONEDRIVE_BASE_PATH, 'Music_Sheets');
const SONGS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'songs.json');
const WORSHIP_LISTS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'worship_lists.json');

// 파일명에서 안전하지 않은 문자를 제거하는 함수
const sanitizeFileName = (fileName) => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '-')  // 특수문자를 하이픈으로 변환
    .trim()                         // 앞뒤 공백 제거
    .substring(0, 200);             // 파일명 길이 제한
};

// 찬양 제목에서 1/2, 2/2 같은 패턴을 처리하는 함수
const processSongTitle = (title) => {
  // 1/2, 2/2 같은 패턴을 찾아서 슬래시 앞 부분만 남김
  return title.replace(/\s+\d+\/\d+$/, (match) => {
    const number = match.trim().split('/')[0];
    return ` ${number}`;
  });
};

// 데이터베이스의 찬양 정보를 기반으로 파일명을 생성하는 함수
const generateFileNameFromDatabase = (song) => {
  const processedTitle = processSongTitle(song.title);
  const safeTitle = sanitizeFileName(processedTitle);
  const safeKey = sanitizeFileName(song.key || song.code || '');
  
  return `${safeTitle} (${safeKey}) (${song.id}).jpg`;
};

// 기존 파일명에서 찬양 정보를 추출하는 함수 (다양한 패턴 지원)
const extractSongInfoFromFileName = (fileName) => {
  const withoutExt = path.parse(fileName).name;
  
  // 패턴 1: "제목_코드_(ID).jpg" -> ID 추출
  const pattern1 = /^(.+)_([^_]+)_\(([^)]+)\)$/;
  const match1 = withoutExt.match(pattern1);
  if (match1) {
    return {
      title: match1[1].replace(/_/g, ' '),
      key: match1[2],
      id: match1[3]
    };
  }
  
  // 패턴 2: "제목 코드.jpg" -> 제목과 코드 추출
  const pattern2 = /^(.+)\s+([A-G][b#]?)\s*$/;
  const match2 = withoutExt.match(pattern2);
  if (match2) {
    return {
      title: match2[1].trim(),
      key: match2[2],
      id: null
    };
  }
  
  // 패턴 3: "제목 (코드).jpg" -> 제목과 코드 추출
  const pattern3 = /^(.+)\s+\(([A-G][b#]?)\)\s*$/;
  const match3 = withoutExt.match(pattern3);
  if (match3) {
    return {
      title: match3[1].trim(),
      key: match3[2],
      id: null
    };
  }
  
  // 패턴 4: ID만 있는 경우 "abc123.jpg"
  if (/^[a-zA-Z0-9]+$/.test(withoutExt)) {
    return {
      title: null,
      key: null,
      id: withoutExt
    };
  }
  
  return null;
};

// 메인 함수
async function renameSheetsFromDatabase() {
  try {
    console.log('🎵 데이터베이스 기반 악보 파일명 변경 스크립트 시작...\n');
    
    // 1. 데이터베이스 파일들 로드
    console.log('📁 데이터베이스 파일 로드 중...');
    
    if (!fs.existsSync(SONGS_FILE_PATH)) {
      throw new Error(`songs.json 파일을 찾을 수 없습니다: ${SONGS_FILE_PATH}`);
    }
    
    if (!fs.existsSync(WORSHIP_LISTS_FILE_PATH)) {
      throw new Error(`worship_lists.json 파일을 찾을 수 없습니다: ${WORSHIP_LISTS_FILE_PATH}`);
    }
    
    const songsData = JSON.parse(fs.readFileSync(SONGS_FILE_PATH, 'utf8'));
    const worshipListsData = JSON.parse(fs.readFileSync(WORSHIP_LISTS_FILE_PATH, 'utf8'));
    
    console.log(`✅ songs.json 로드 완료: ${songsData.songs.length}개 찬양`);
    console.log(`✅ worship_lists.json 로드 완료: ${Object.keys(worshipListsData.worshipLists || {}).length}개 리스트\n`);
    
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
    
    // 3. 찬양 데이터를 ID로 매핑
    const songsById = {};
    const songsByTitle = {};
    songsData.songs.forEach(song => {
      songsById[song.id] = song;
      // 제목으로도 매핑 (중복 제목 처리용)
      if (!songsByTitle[song.title]) {
        songsByTitle[song.title] = [];
      }
      songsByTitle[song.title].push(song);
    });
    
    // 4. 파일명 변경 및 데이터베이스 업데이트
    let renamedCount = 0;
    let updatedSongsCount = 0;
    let updatedWorshipListsCount = 0;
    const errors = [];
    const fileMapping = {}; // 기존 파일명 -> 새 파일명 매핑
    
    console.log('🔄 파일명 변경 및 데이터베이스 업데이트 시작...\n');
    
    for (const oldFileName of musicFiles) {
      try {
        console.log(`처리 중: ${oldFileName}`);
        
        // 기존 파일명에서 찬양 정보 추출
        const extractedInfo = extractSongInfoFromFileName(oldFileName);
        
        if (!extractedInfo) {
          console.log(`  ⚠️  파일명에서 찬양 정보를 추출할 수 없습니다. 건너뜀.`);
          continue;
        }
        
        // 데이터베이스에서 찬양 정보 찾기
        let song = null;
        
        // 1. ID로 찾기
        if (extractedInfo.id) {
          song = songsById[extractedInfo.id];
          if (song) {
            console.log(`  🔍 ID로 매칭: ${song.title} (ID: ${song.id})`);
          }
        }
        
        // 2. 제목으로 찾기
        if (!song && extractedInfo.title) {
          const matchingSongs = songsByTitle[extractedInfo.title] || [];
          
          if (matchingSongs.length === 1) {
            song = matchingSongs[0];
            console.log(`  🔍 제목으로 매칭: ${song.title} (ID: ${song.id})`);
          } else if (matchingSongs.length > 1) {
            // 여러 개 매칭되는 경우 코드도 일치하는지 확인
            const exactMatch = matchingSongs.find(s => s.key === extractedInfo.key || s.code === extractedInfo.key);
            if (exactMatch) {
              song = exactMatch;
              console.log(`  🔍 제목+코드로 매칭: ${song.title} (ID: ${song.id})`);
            } else {
              console.log(`  ⚠️  여러 찬양이 매칭됩니다. 건너뜀: ${extractedInfo.title}`);
              continue;
            }
          }
        }
        
        if (!song) {
          console.log(`  ⚠️  데이터베이스에서 찬양을 찾을 수 없습니다. 건너뜀: ${extractedInfo.title || extractedInfo.id}`);
          continue;
        }
        
        // 새로운 파일명 생성
        const newFileName = generateFileNameFromDatabase(song);
        
        if (!newFileName) {
          console.log(`  ⚠️  새로운 파일명을 생성할 수 없습니다. 건너뜀.`);
          continue;
        }
        
        // 파일명이 이미 올바른 형식인지 확인
        if (oldFileName === newFileName) {
          console.log(`  ✅ 이미 올바른 형식입니다. 건너뜀.`);
          continue;
        }
        
        // 파일명 변경
        const oldFilePath = path.join(MUSIC_SHEETS_PATH, oldFileName);
        const newFilePath = path.join(MUSIC_SHEETS_PATH, newFileName);
        
        if (fs.existsSync(newFilePath)) {
          console.log(`  ⚠️  대상 파일이 이미 존재합니다: ${newFileName}. 건너뜀.`);
          continue;
        }
        
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`  ✅ ${oldFileName} → ${newFileName}`);
        renamedCount++;
        
        // 파일 매핑 저장
        fileMapping[oldFileName] = newFileName;
        
        // 데이터베이스에서 파일명 업데이트
        if (song.fileName !== newFileName) {
          song.fileName = newFileName;
          song.filePath = path.join('Music_Sheets', newFileName);
          updatedSongsCount++;
        }
        
      } catch (error) {
        const errorMsg = `파일 ${oldFileName} 처리 중 오류: ${error.message}`;
        console.log(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    // 5. 찬양 리스트에서도 파일명 업데이트
    console.log('\n🔄 찬양 리스트 파일명 업데이트 중...');
    
    Object.keys(worshipListsData.worshipLists || {}).forEach(dateKey => {
      const worshipList = worshipListsData.worshipLists[dateKey];
      worshipList.forEach(song => {
        if (song.id && songsById[song.id]) {
          const updatedSong = songsById[song.id];
          if (updatedSong.fileName && song.fileName !== updatedSong.fileName) {
            song.fileName = updatedSong.fileName;
            song.filePath = updatedSong.filePath;
            updatedWorshipListsCount++;
          }
        }
      });
    });
    
    // 6. 데이터베이스 파일 저장
    console.log('\n💾 데이터베이스 파일 저장 중...');
    
    // songs.json 저장
    songsData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(SONGS_FILE_PATH, JSON.stringify(songsData, null, 2), 'utf8');
    console.log('✅ songs.json 저장 완료');
    
    // worship_lists.json 저장
    worshipListsData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(WORSHIP_LISTS_FILE_PATH, JSON.stringify(worshipListsData, null, 2), 'utf8');
    console.log('✅ worship_lists.json 저장 완료');
    
    // 7. 결과 요약
    console.log('\n🎉 작업 완료!');
    console.log('='.repeat(50));
    console.log(`📁 파일명 변경: ${renamedCount}개`);
    console.log(`🎵 찬양 데이터베이스 업데이트: ${updatedSongsCount}개`);
    console.log(`📋 찬양 리스트 업데이트: ${updatedWorshipListsCount}개`);
    
    if (errors.length > 0) {
      console.log(`\n❌ 오류 발생: ${errors.length}개`);
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n✨ 모든 악보 파일이 데이터베이스 기반 명명 규칙에 맞게 변경되었습니다!');
    console.log('📝 파일명 형식: "찬양 제목 (코드) (ID).jpg"');
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  renameSheetsFromDatabase();
}

module.exports = { renameSheetsFromDatabase };
