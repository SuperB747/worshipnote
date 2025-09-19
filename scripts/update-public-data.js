const fs = require('fs');
const path = require('path');
const os = require('os');

// OneDrive 경로 찾기 함수
const findOneDrivePath = () => {
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(homeDir, 'OneDrive'),
    path.join(homeDir, 'OneDrive - Personal'),
    path.join(homeDir, 'OneDrive - 회사명'), // 한국어 회사명
    path.join(homeDir, 'OneDrive - Company'), // 영어 회사명
  ];

  for (const oneDrivePath of possiblePaths) {
    if (fs.existsSync(oneDrivePath)) {
      return oneDrivePath;
    }
  }
  return null;
};

async function updatePublicData() {
  try {
    console.log('🔄 public/data.json 업데이트 시작...');
    
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
    
    // songs.json 읽기
    let songs = [];
    if (fs.existsSync(songsFilePath)) {
      const songsData = JSON.parse(fs.readFileSync(songsFilePath, 'utf8'));
      songs = songsData.songs || [];
      console.log(`📊 찬양 데이터: ${songs.length}개`);
    } else {
      console.warn('⚠️ songs.json 파일을 찾을 수 없습니다.');
    }
    
    // worship_lists.json 읽기
    let worshipLists = {};
    if (fs.existsSync(worshipListsFilePath)) {
      const worshipListsData = JSON.parse(fs.readFileSync(worshipListsFilePath, 'utf8'));
      worshipLists = worshipListsData.worshipLists || {};
      console.log(`📅 찬양 리스트: ${Object.keys(worshipLists).length}개 날짜`);
    } else {
      console.warn('⚠️ worship_lists.json 파일을 찾을 수 없습니다.');
    }
    
    // 통합 데이터 생성
    const publicData = {
      songs,
      worshipLists,
      lastUpdated: new Date().toISOString(),
      source: 'OneDrive'
    };
    
    // public/data.json 업데이트
    const publicDataPath = path.join(__dirname, '..', 'public', 'data.json');
    fs.writeFileSync(publicDataPath, JSON.stringify(publicData, null, 2), 'utf8');
    
    console.log('✅ public/data.json 업데이트 완료!');
    console.log(`📊 업데이트된 데이터:`);
    console.log(`   - 찬양: ${songs.length}개`);
    console.log(`   - 찬양 리스트: ${Object.keys(worshipLists).length}개 날짜`);
    console.log(`   - 파일 경로: ${publicDataPath}`);
    
  } catch (error) {
    console.error('❌ public/data.json 업데이트 실패:', error);
  }
}

// 스크립트 실행
updatePublicData();
