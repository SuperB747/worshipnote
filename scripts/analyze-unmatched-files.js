const fs = require('fs');
const path = require('path');

// OneDrive 경로 설정
const ONEDRIVE_BASE_PATH = process.env.ONEDRIVE_PATH || 'C:\\Users\\brian\\OneDrive\\WorshipNote_Data';
const MUSIC_SHEETS_PATH = path.join(ONEDRIVE_BASE_PATH, 'Music_Sheets');
const SONGS_FILE_PATH = path.join(ONEDRIVE_BASE_PATH, 'Database', 'songs.json');

// 파일명에서 찬양 정보를 추출하는 함수 (기존과 동일)
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
async function analyzeUnmatchedFiles() {
  try {
    console.log('🔍 처리되지 않은 파일들 분석 중...\n');
    
    // 1. 데이터베이스 로드
    const songsData = JSON.parse(fs.readFileSync(SONGS_FILE_PATH, 'utf8'));
    console.log(`📁 데이터베이스 로드: ${songsData.songs.length}개 찬양\n`);
    
    // 2. Music_Sheets 폴더의 모든 파일 확인
    const musicFiles = fs.readdirSync(MUSIC_SHEETS_PATH)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext);
      });
    
    console.log(`📁 Music_Sheets 폴더: ${musicFiles.length}개 파일\n`);
    
    // 3. 파일명에서 찬양 정보 추출 시도
    const unmatchedFiles = [];
    const matchedFiles = [];
    
    for (const fileName of musicFiles) {
      const extractedInfo = extractSongInfoFromFileName(fileName);
      
      if (!extractedInfo) {
        unmatchedFiles.push(fileName);
      } else {
        matchedFiles.push({ fileName, extractedInfo });
      }
    }
    
    console.log(`✅ 매칭된 파일: ${matchedFiles.length}개`);
    console.log(`❌ 매칭되지 않은 파일: ${unmatchedFiles.length}개\n`);
    
    // 4. 매칭되지 않은 파일들 분석
    console.log('📋 매칭되지 않은 파일들:\n');
    
    const categories = {
      'page 포함': [],
      '숫자 포함': [],
      '특수문자 포함': [],
      '한영 혼합': [],
      '짧은 파일명': [],
      '기타': []
    };
    
    unmatchedFiles.forEach(fileName => {
      const withoutExt = path.parse(fileName).name;
      
      if (withoutExt.includes('page')) {
        categories['page 포함'].push(fileName);
      } else if (/\d+/.test(withoutExt)) {
        categories['숫자 포함'].push(fileName);
      } else if (/[^가-힣a-zA-Z0-9\s]/.test(withoutExt)) {
        categories['특수문자 포함'].push(fileName);
      } else if (/[a-zA-Z]/.test(withoutExt) && /[가-힣]/.test(withoutExt)) {
        categories['한영 혼합'].push(fileName);
      } else if (withoutExt.length < 5) {
        categories['짧은 파일명'].push(fileName);
      } else {
        categories['기타'].push(fileName);
      }
    });
    
    // 카테고리별 출력
    Object.keys(categories).forEach(category => {
      if (categories[category].length > 0) {
        console.log(`\n📂 ${category} (${categories[category].length}개):`);
        categories[category].forEach(fileName => {
          console.log(`  - ${fileName}`);
        });
      }
    });
    
    // 5. 첫 가사로 매칭 시도
    console.log('\n\n🎵 첫 가사로 매칭 시도...\n');
    
    const firstLyricsMatches = [];
    
    for (const fileName of unmatchedFiles) {
      const withoutExt = path.parse(fileName).name;
      
      // 파일명에서 가능한 제목 추출 시도
      let possibleTitle = withoutExt
        .replace(/page\d+/gi, '') // page1, page2 등 제거
        .replace(/\d+/g, '') // 숫자 제거
        .replace(/[^가-힣a-zA-Z\s]/g, '') // 특수문자 제거
        .trim();
      
      if (possibleTitle.length < 2) continue;
      
      // 첫 가사와 매칭 시도
      const matchingSongs = songsData.songs.filter(song => {
        if (!song.firstLyrics) return false;
        
        // 정확한 매칭
        if (song.firstLyrics.includes(possibleTitle) || possibleTitle.includes(song.firstLyrics)) {
          return true;
        }
        
        // 부분 매칭 (3글자 이상)
        if (possibleTitle.length >= 3) {
          const words = possibleTitle.split(/\s+/);
          return words.some(word => 
            word.length >= 3 && song.firstLyrics.includes(word)
          );
        }
        
        return false;
      });
      
      if (matchingSongs.length > 0) {
        firstLyricsMatches.push({
          fileName,
          possibleTitle,
          matches: matchingSongs.map(song => ({
            title: song.title,
            firstLyrics: song.firstLyrics,
            key: song.key || song.code,
            id: song.id
          }))
        });
      }
    }
    
    console.log(`🎯 첫 가사로 매칭 가능한 파일: ${firstLyricsMatches.length}개\n`);
    
    firstLyricsMatches.forEach(match => {
      console.log(`📄 ${match.fileName}`);
      console.log(`   추출된 제목: "${match.possibleTitle}"`);
      console.log(`   매칭된 찬양들:`);
      match.matches.forEach(song => {
        console.log(`     - ${song.title} (${song.key}) - "${song.firstLyrics}"`);
      });
      console.log('');
    });
    
    // 6. 요약
    console.log('\n📊 분석 요약:');
    console.log('='.repeat(50));
    console.log(`총 파일 수: ${musicFiles.length}개`);
    console.log(`매칭된 파일: ${matchedFiles.length}개`);
    console.log(`매칭되지 않은 파일: ${unmatchedFiles.length}개`);
    console.log(`첫 가사로 매칭 가능: ${firstLyricsMatches.length}개`);
    
    console.log('\n📋 매칭되지 않은 파일 카테고리:');
    Object.keys(categories).forEach(category => {
      if (categories[category].length > 0) {
        console.log(`  ${category}: ${categories[category].length}개`);
      }
    });
    
  } catch (error) {
    console.error('❌ 분석 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  analyzeUnmatchedFiles();
}

module.exports = { analyzeUnmatchedFiles };
