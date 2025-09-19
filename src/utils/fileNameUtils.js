// 파일명 규칙을 확인하고 생성하는 유틸리티 함수들

// 파일명이 올바른 형식인지 확인하는 함수
export const isCorrectFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return false;
  
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // 패턴: "찬양 제목 (코드) (ID).jpg"
  const correctPattern = /^(.+)\s+\(([A-G][b#]?[m]?)\)\s+\(([^)]+)\)$/;
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
  const pattern = /^(.+)\s+\(([A-G][b#]?[m]?)\)\s+\(([^)]+)\)$/;
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

// 찬양 정보가 변경되었을 때 파일명을 업데이트하는 함수
export const updateFileNameForSong = async (oldSong, newSong) => {
  try {
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI || !window.electronAPI.renameFile) {
      console.warn('Electron API를 사용할 수 없습니다.');
      return { success: false, error: 'Electron API를 사용할 수 없습니다.' };
    }

    // 파일명이 변경되지 않았으면 스킵
    if (oldSong.title === newSong.title && oldSong.key === newSong.key) {
      return { success: true, message: '파일명 변경이 필요하지 않습니다.' };
    }

    // 기존 파일명이 없으면 스킵
    if (!oldSong.fileName || oldSong.fileName.trim() === '') {
      return { success: true, message: '기존 파일이 없습니다.' };
    }

    // 새로운 파일명 생성
    const newFileName = generateCorrectFileName(newSong);
    if (!newFileName) {
      return { success: false, error: '새로운 파일명을 생성할 수 없습니다.' };
    }

    // 파일명이 동일하면 스킵
    if (oldSong.fileName === newFileName) {
      return { success: true, message: '파일명이 동일합니다.' };
    }

    // Music_Sheets 경로 가져오기
    const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
    const oldFilePath = `${musicSheetsPath}/${oldSong.fileName}`;
    const newFilePath = `${musicSheetsPath}/${newFileName}`;

    // 파일 존재 여부 확인
    try {
      await window.electronAPI.readFile(oldFilePath);
    } catch (error) {
      return { success: false, error: '기존 파일을 찾을 수 없습니다.' };
    }

    // 파일명 변경
    const renameResult = await window.electronAPI.renameFile(oldFilePath, newFilePath);
    
    if (renameResult.success) {
      return {
        success: true,
        message: '파일명이 성공적으로 변경되었습니다.',
        oldFileName: oldSong.fileName,
        newFileName: newFileName
      };
    } else {
      return {
        success: false,
        error: `파일명 변경 실패: ${renameResult.error}`
      };
    }
  } catch (error) {
    console.error('파일명 업데이트 중 오류:', error);
    return {
      success: false,
      error: `파일명 업데이트 중 오류가 발생했습니다: ${error.message}`
    };
  }
};
