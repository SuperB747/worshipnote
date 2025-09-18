// OneDrive 경로 설정
const ONEDRIVE_PATH = 'WorshipNote_Data/Music_Sheets';

// PDF.js 라이브러리 동적 로드
const loadPDFJS = async () => {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }
  
  // PDF.js 라이브러리 동적 로드
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.async = true;
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// PDF를 JPG로 변환하는 함수
const convertPDFToJPG = async (file) => {
  try {
    const pdfjsLib = await loadPDFJS();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // 첫 번째 페이지만 변환 (악보는 보통 첫 페이지만 필요)
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3.0 }); // 최고 해상도로 변환
    
    // Canvas 생성
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // PDF 페이지를 Canvas에 렌더링
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Canvas를 JPG Blob으로 변환
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const jpgFile = new File([blob], fileName, { type: 'image/jpeg' });
          resolve({
            success: true,
            file: jpgFile,
            fileName: fileName
          });
        } else {
          resolve({
            success: false,
            error: 'PDF를 JPG로 변환하는데 실패했습니다.'
          });
        }
      }, 'image/jpeg', 1.0);
    });
  } catch (error) {
    console.error('PDF 변환 중 오류:', error);
    return {
      success: false,
      error: `PDF 변환 실패: ${error.message}`
    };
  }
};

// 파일을 JPG로 변환하는 함수
export const convertToJPG = async (file) => {
  try {
    const fileType = file.type;
    const originalFileName = file.name; // 원본 파일명 유지 (확장자 포함)
    const fileName = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거 (변환용)
    
    if (fileType === 'application/pdf') {
      // PDF 파일을 JPG로 변환
      return await convertPDFToJPG(file);
    } else if (fileType.startsWith('image/')) {
      // 이미지 파일인 경우 JPG로 변환
      const arrayBuffer = await file.arrayBuffer();
      
      // 이미지를 Canvas로 로드하여 JPG로 변환
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      return new Promise((resolve) => {
        img.onload = () => {
          // 고해상도 처리를 위한 스케일 팩터
          const scaleFactor = 2; // 2배 해상도로 처리하여 고화질 보장
          
          // 원본 이미지 크기 사용 (최대 크기 제한)
          const maxWidth = 3000; // 최대 너비
          const maxHeight = 4000; // 최대 높이
          
          let { width, height } = img;
          
          // 비율을 유지하면서 크기 조정 (최대 크기 내에서)
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          width *= ratio;
          height *= ratio;
          
          // 고해상도 캔버스 설정
          canvas.width = width * scaleFactor;
          canvas.height = height * scaleFactor;
          
          // 캔버스 스케일링 설정
          ctx.scale(scaleFactor, scaleFactor);
          
          // 고품질 이미지 렌더링 설정
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // PNG 투명 배경을 위한 흰색 배경 그리기
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          // Canvas에 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);
          
          // 최고 품질로 Canvas를 JPG로 변환 (품질 1.0 = 100%)
          canvas.toBlob((blob) => {
            if (blob) {
              const jpgFile = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });
              resolve({
                success: true,
                file: jpgFile,
                fileName: `${fileName}.jpg`, // 변환된 JPG 파일명 반환
                filePath: null
              });
            } else {
              resolve({
                success: false,
                error: 'JPG 변환에 실패했습니다.'
              });
            }
          }, 'image/jpeg', 1.0);
        };
        
        img.onerror = () => {
          resolve({
            success: false,
            error: '이미지 로드에 실패했습니다.'
          });
        };
        
        // 고품질 이미지 로드 설정
        img.crossOrigin = 'anonymous'; // CORS 설정
        img.decoding = 'async'; // 비동기 디코딩으로 성능 향상
        
        // 이미지 로드
        const blob = new Blob([arrayBuffer], { type: fileType });
        img.src = URL.createObjectURL(blob);
      });
    } else {
      throw new Error('지원하지 않는 파일 형식입니다.');
    }
  } catch (error) {
    console.error('파일 변환 중 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// OneDrive에 파일 저장하는 함수 (Electron 환경에서)
export const saveToOneDrive = async (arrayBuffer, fileName) => {
  try {
    if (window.electronAPI) {
      // Electron 환경에서 OneDrive 경로에 저장
      const result = await window.electronAPI.saveFile({
        arrayBuffer: arrayBuffer,
        fileName: fileName,
        folderPath: 'Music_Sheets'
      });
      
      if (result.success) {
        return {
          success: true,
          filePath: result.filePath,
          message: result.message
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } else {
      // 웹 환경에서는 에러 반환
      return {
        success: false,
        error: 'Electron 환경에서만 파일 저장이 지원됩니다.'
      };
    }
  } catch (error) {
    console.error('OneDrive 저장 중 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 파일명에서 안전하지 않은 문자를 제거하는 함수
const sanitizeFileName = (fileName) => {
  // Windows와 Mac에서 파일명에 사용할 수 없는 문자들을 안전한 문자로 변환
  return fileName
    .replace(/[<>:"/\\|?*]/g, '-')  // 특수문자를 하이픈으로 변환
    .trim()                         // 앞뒤 공백 제거
    .substring(0, 200);             // 파일명 길이 제한 (Windows 제한 고려)
};

// 찬양 정보를 기반으로 파일명을 생성하는 함수 (새로운 규칙)
const generateSongFileName = (songTitle, songKey, songId) => {
  if (!songId) {
    return null; // ID가 없으면 null 반환
  }
  
  // 찬양 제목에서 1/2, 2/2 같은 패턴을 처리
  const processedTitle = songTitle.replace(/\s+\d+\/\d+$/, (match) => {
    const number = match.trim().split('/')[0];
    return ` ${number}`;
  });
  
  // 제목과 코드를 안전한 파일명으로 변환
  const safeTitle = sanitizeFileName(processedTitle);
  const safeKey = sanitizeFileName(songKey);
  
  // 파일명 형식: "찬양 제목 (코드) (ID).jpg"
  const fileName = `${safeTitle} (${safeKey}) (${songId}).jpg`;
  
  return fileName;
};

// 파일 업로드 및 변환 전체 프로세스
export const processFileUpload = async (file, songId = null, songTitle = null, songKey = null) => {
  try {
    // 1. 파일을 JPG로 변환
    const conversionResult = await convertToJPG(file);
    
    if (!conversionResult.success) {
      return conversionResult;
    }
    
    // 2. 찬양 정보 기반 파일명 생성
    let finalFileName;
    if (songId && songTitle && songKey) {
      // 찬양 정보가 모두 있으면 상세한 파일명 생성
      finalFileName = generateSongFileName(songTitle, songKey, songId);
    } else if (songId) {
      // ID만 있으면 ID 기반 파일명 생성
      finalFileName = `${songId}.jpg`;
    } else {
      // ID가 없으면 원본 파일명 사용
      finalFileName = conversionResult.fileName;
    }
    
    // 3. File 객체를 ArrayBuffer로 변환
    const arrayBuffer = await conversionResult.file.arrayBuffer();
    
    // 4. OneDrive에 저장
    const saveResult = await saveToOneDrive(
      arrayBuffer, 
      finalFileName
    );
    
    if (!saveResult.success) {
      return saveResult;
    }
    
    return {
      success: true,
      fileName: finalFileName,
      filePath: saveResult.filePath,
      message: saveResult.message,
      skipped: saveResult.skipped || false
    };
  } catch (error) {
    console.error('파일 처리 중 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
