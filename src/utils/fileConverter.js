// OneDrive 경로 설정
const ONEDRIVE_PATH = 'WorshipNote_Data/Music_Sheets';

// 파일을 JPG로 변환하는 함수
export const convertToJPG = async (file) => {
  try {
    const fileType = file.type;
    const fileName = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
    
    if (fileType === 'application/pdf') {
      // PDF 파일인 경우 에러 반환 (PDF는 변환하지 않음)
      return {
        success: false,
        error: 'PDF 파일은 JPG로 변환할 수 없습니다. JPG 또는 PNG 파일을 업로드해주세요.'
      };
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
          
          // Canvas에 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);
          
          // 최고 품질로 Canvas를 JPG로 변환 (품질 0.95 = 95%)
          canvas.toBlob((blob) => {
            if (blob) {
              const jpgFile = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });
              resolve({
                success: true,
                file: jpgFile,
                fileName: fileName,
                filePath: null
              });
            } else {
              resolve({
                success: false,
                error: 'JPG 변환에 실패했습니다.'
              });
            }
          }, 'image/jpeg', 0.95);
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

// 파일 업로드 및 변환 전체 프로세스
export const processFileUpload = async (file) => {
  try {
    // 1. 파일을 JPG로 변환
    const conversionResult = await convertToJPG(file);
    
    if (!conversionResult.success) {
      return conversionResult;
    }
    
    // 2. File 객체를 ArrayBuffer로 변환
    const arrayBuffer = await conversionResult.file.arrayBuffer();
    
    // 3. OneDrive에 저장
    const saveResult = await saveToOneDrive(
      arrayBuffer, 
      conversionResult.fileName // 이미 .jpg 확장자가 포함되어 있음
    );
    
    if (!saveResult.success) {
      return saveResult;
    }
    
    return {
      success: true,
      fileName: conversionResult.fileName,
      filePath: saveResult.filePath,
      message: saveResult.message
    };
  } catch (error) {
    console.error('파일 처리 중 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
