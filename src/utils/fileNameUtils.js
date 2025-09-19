// 파일명 규칙을 확인하고 생성하는 유틸리티 함수들

// 파일명이 올바른 형식인지 확인하는 함수
export const isCorrectFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return false;
  
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // 패턴: "찬양 제목 (코드) (ID).jpg"
  const correctPattern = /^(.+)\s+\(([A-G][b#]?)\)\s+\(([^)]+)\)$/;
  return correctPattern.test(withoutExt);
};

// 찬양 정보를 기반으로 올바른 파일명을 생성하는 함수
export const generateCorrectFileName = (song) => {
  if (!song || !song.id) return null;
  
  // 찬양 제목에서 1/2, 2/2 같은 패턴을 처리
  const processedTitle = song.title.replace(/\s+\d+\/\d+$/, (match) => {
    const number = match.trim().split('/')[0];
    return ` ${number}`;
  });
  
  // 파일명에서 안전하지 않은 문자를 제거
  const safeTitle = processedTitle
    .replace(/[<>:"/\\|?*]/g, '-')  // 특수문자를 하이픈으로 변환
    .trim()                         // 앞뒤 공백 제거
    .substring(0, 200);             // 파일명 길이 제한
  
  const safeKey = (song.key || song.code || '').replace(/[<>:"/\\|?*]/g, '-');
  
  return `${safeTitle} (${safeKey}) (${song.id}).jpg`;
};

// 파일명에서 찬양 정보를 추출하는 함수
export const extractSongInfoFromFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return null;
  
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // 패턴: "찬양 제목 (코드) (ID).jpg"
  const pattern = /^(.+)\s+\(([A-G][b#]?)\)\s+\(([^)]+)\)$/;
  const match = withoutExt.match(pattern);
  
  if (match) {
    return {
      title: match[1].trim(),
      key: match[2],
      id: match[3],
      isCorrect: true
    };
  }
  
  return {
    title: withoutExt,
    key: null,
    id: null,
    isCorrect: false
  };
};
