const fs = require('fs');
const path = require('path');

// 데이터 파일 경로
const dataPath = path.join(__dirname, '../public/data.json');
const storagePath = path.join(__dirname, '../src/utils/storage.js');

console.log('=== 찬양 ID 동기화 스크립트 시작 ===');

// 데이터베이스에서 곡 목록 로드
let songsData;
try {
  const dataContent = fs.readFileSync(dataPath, 'utf8');
  songsData = JSON.parse(dataContent);
  console.log(`데이터베이스에서 ${songsData.songs.length}개 곡 로드됨`);
} catch (error) {
  console.error('데이터베이스 로드 실패:', error);
  process.exit(1);
}

// 찬양 리스트 데이터 로드 (OneDrive에서)
let worshipLists = {};
try {
  // OneDrive에서 찬양 리스트 데이터 로드
  const oneDrivePath = process.env.USERPROFILE + '\\OneDrive\\WorshipNote_Data\\Database\\worship_lists.json';
  if (fs.existsSync(oneDrivePath)) {
    const worshipListContent = fs.readFileSync(oneDrivePath, 'utf8');
    const worshipListData = JSON.parse(worshipListContent);
    worshipLists = worshipListData.worshipLists || {};
    console.log(`OneDrive에서 ${Object.keys(worshipLists).length}개 날짜 로드됨`);
  } else {
    console.log('OneDrive 찬양 리스트 파일을 찾을 수 없습니다. 빈 객체로 시작합니다.');
  }
} catch (error) {
  console.error('찬양 리스트 로드 실패:', error);
  // 빈 객체로 시작
  worshipLists = {};
}

// 제목으로 곡을 찾는 함수
function findSongByTitle(title, songs) {
  return songs.find(song => song.title === title);
}

// ID 동기화 실행
let syncCount = 0;
let totalSongs = 0;

Object.keys(worshipLists).forEach(dateKey => {
  const songs = worshipLists[dateKey];
  totalSongs += songs.length;
  
  console.log(`\n--- ${dateKey} 날짜 처리 중 (${songs.length}개 곡) ---`);
  
  songs.forEach((song, index) => {
    // 원본 데이터베이스에서 같은 제목의 곡 찾기
    const originalSong = findSongByTitle(song.title, songsData.songs);
    
    if (originalSong) {
      if (song.id !== originalSong.id) {
        console.log(`  ${index + 1}. "${song.title}" ID 변경: ${song.id} -> ${originalSong.id}`);
        
        // 원본 곡의 모든 정보로 업데이트 (ID 포함)
        Object.assign(song, originalSong);
        syncCount++;
      } else {
        console.log(`  ${index + 1}. "${song.title}" ID 일치 (${song.id})`);
      }
    } else {
      console.log(`  ${index + 1}. "${song.title}" - 원본 데이터베이스에서 찾을 수 없음`);
    }
  });
});

console.log(`\n=== 동기화 완료 ===`);
console.log(`총 처리된 곡: ${totalSongs}개`);
console.log(`ID가 변경된 곡: ${syncCount}개`);

// 동기화된 찬양 리스트를 OneDrive에 저장
if (syncCount > 0) {
  try {
    // OneDrive 경로
    const oneDrivePath = process.env.USERPROFILE + '\\OneDrive\\WorshipNote_Data\\Database';
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(oneDrivePath)) {
      fs.mkdirSync(oneDrivePath, { recursive: true });
    }
    
    // 찬양 리스트 데이터 저장
    const worshipListData = {
      worshipLists,
      lastUpdated: new Date().toISOString()
    };
    
    const worshipListFilePath = oneDrivePath + '\\worship_lists.json';
    fs.writeFileSync(worshipListFilePath, JSON.stringify(worshipListData, null, 2), 'utf8');
    console.log('찬양 리스트가 OneDrive에 저장되었습니다.');
  } catch (error) {
    console.error('OneDrive 저장 실패:', error);
  }
} else {
  console.log('변경사항이 없어서 저장하지 않았습니다.');
}

console.log('=== 스크립트 완료 ===');
