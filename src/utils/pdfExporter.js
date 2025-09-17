import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// OneDrive 경로 찾기 함수
const findOneDrivePath = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.getOneDrivePath) {
      console.error('Electron API를 사용할 수 없습니다. window.electronAPI:', window.electronAPI);
      return null;
    }
    return await window.electronAPI.getOneDrivePath();
  } catch (error) {
    console.error('OneDrive 경로 찾기 실패:', error);
    return null;
  }
};

// PDF 저장 경로 생성
const getPdfSavePath = async (date) => {
  const oneDrivePath = await findOneDrivePath();
  if (!oneDrivePath) {
    throw new Error('OneDrive 경로를 찾을 수 없습니다.');
  }

  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dayOfWeek = dateObj.getDay(); // 0=일요일, 5=금요일

  // 요일별 파일명 설정
  const serviceType = dayOfWeek === 5 ? '금요기도회' : '주일예배';
  const fileName = `${year}${month}${day} ${serviceType} 찬양 리스트.pdf`;

  // OneDrive 경로 구성 (수동으로 경로 구분자 처리)
  const pathSeparator = oneDrivePath.includes('\\') ? '\\' : '/';
  const pdfPath = `${oneDrivePath}${pathSeparator}Documents${pathSeparator}Archive${pathSeparator}한소망교회${pathSeparator}찬양 리스트${pathSeparator}찬양리스트모음${pathSeparator}${fileName}`;
  
  return pdfPath;
};

// Electron을 통해 이미지 파일을 읽어서 Blob으로 변환
const imageFileToBlob = async (filePath) => {
  try {
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI || !window.electronAPI.readFile) {
      console.error('Electron API를 사용할 수 없습니다. window.electronAPI:', window.electronAPI);
      throw new Error('Electron API를 사용할 수 없습니다.');
    }

    console.log('이미지 파일 읽기 시도:', filePath);

    // 파일 존재 여부 확인을 위해 먼저 읽기 시도
    try {
      const fileData = await window.electronAPI.readFile(filePath);
      if (!fileData) {
        console.error('파일 데이터가 null입니다:', filePath);
        throw new Error('파일을 읽을 수 없습니다.');
      }

      console.log('파일 데이터 타입:', typeof fileData, '크기:', fileData.length);

      // Buffer를 Blob으로 변환
      const blob = new Blob([fileData], { type: 'image/jpeg' });
      console.log('Blob 생성 성공, 크기:', blob.size);
      return blob;
    } catch (readError) {
      console.error('파일 읽기 오류:', readError);
      // 파일이 존재하지 않거나 접근할 수 없는 경우
      if (readError.message.includes('ENOENT') || readError.message.includes('파일을 읽을 수 없습니다')) {
        console.warn('파일이 존재하지 않거나 접근할 수 없습니다:', filePath);
        return null;
      }
      throw readError;
    }
  } catch (error) {
    console.error('이미지 로드 실패:', error);
    return null;
  }
};

// Blob을 Base64로 변환
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// PDF 생성 함수
export const generateWorshipListPDF = async (songs, date) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });

    // 레터 사이즈: 8.5 x 11 인치
    const pageWidth = 8.5;
    const pageHeight = 11;
    
    // Narrow 여백 설정 (0.5인치)
    const margin = 0.5;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    let currentY = margin;
    let isFirstPage = true;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      
      // 새 페이지가 필요한지 확인
      if (currentY > pageHeight - margin - 1) {
        pdf.addPage();
        currentY = margin;
        isFirstPage = false;
      }

      // 악보 파일이 있는 경우에만 처리
      if (song.fileName && song.filePath) {
        try {
          // Electron을 통해 이미지 파일을 Blob으로 로드
          const blob = await imageFileToBlob(song.filePath);
          if (!blob) {
            console.warn(`이미지 로드 실패, 건너뛰기: ${song.fileName}`);
            continue;
          }

          // Blob을 Base64로 변환
          const base64 = await blobToBase64(blob);
          
          // 이미지 로드
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = base64;
          });

          // 이미지 비율 유지하면서 최대 크기 계산
          const imgAspectRatio = img.width / img.height;
          const contentAspectRatio = contentWidth / contentHeight;
          
          let imgWidth, imgHeight;
          if (imgAspectRatio > contentAspectRatio) {
            // 이미지가 더 넓음 - 너비를 기준으로 조정
            imgWidth = contentWidth;
            imgHeight = contentWidth / imgAspectRatio;
          } else {
            // 이미지가 더 높음 - 높이를 기준으로 조정
            imgHeight = contentHeight;
            imgWidth = contentHeight * imgAspectRatio;
          }

          // 이미지를 페이지 중간 위쪽에 배치
          const x = margin + (contentWidth - imgWidth) / 2;
          const y = currentY + (contentHeight - imgHeight) / 2 - 0.5; // 위쪽으로 0.5인치 이동

          // 이미지를 PDF에 추가
          pdf.addImage(base64, 'JPEG', x, y, imgWidth, imgHeight);

          // 다음 이미지를 위해 Y 위치 업데이트
          currentY += imgHeight + 0.2; // 이미지 높이 + 여백

        } catch (error) {
          console.error(`이미지 처리 실패 (${song.fileName}):`, error);
          continue;
        }
      }
    }

    // PDF에 이미지가 있는지 확인
    if (pdf.internal.getNumberOfPages() === 1 && pdf.internal.getCurrentPageInfo().pageNumber === 1) {
      // 빈 페이지만 있는 경우 (이미지가 없음)
      console.warn('PDF에 이미지가 없습니다. 악보 파일을 확인해주세요.');
    }

    // PDF 저장
    const pdfPath = await getPdfSavePath(date);
    const pdfArrayBuffer = pdf.output('arraybuffer');
    
    // ArrayBuffer를 Uint8Array로 변환
    const pdfUint8Array = new Uint8Array(pdfArrayBuffer);
    
    // Electron을 통해 파일 저장
    if (!window.electronAPI || !window.electronAPI.savePdf) {
      throw new Error('Electron API를 사용할 수 없습니다.');
    }

    const result = await window.electronAPI.savePdf({
      pdfData: pdfUint8Array,
      filePath: pdfPath
    });
    
    if (result.success) {
      return {
        success: true,
        message: `PDF가 성공적으로 생성되었습니다!\n저장 위치: ${pdfPath}`,
        filePath: pdfPath
      };
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 찬양 리스트 요약 정보 생성
export const generateWorshipListSummary = (songs, date) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  const serviceType = dayOfWeek === 5 ? '금요기도회' : '주일예배';
  
  const totalSongs = songs.length;
  const songsWithMusicSheets = songs.filter(song => song.fileName && song.filePath).length;
  const songsWithoutMusicSheets = totalSongs - songsWithMusicSheets;

  return {
    date: date,
    serviceType: serviceType,
    totalSongs: totalSongs,
    songsWithMusicSheets: songsWithMusicSheets,
    songsWithoutMusicSheets: songsWithoutMusicSheets,
    songs: songs.map(song => ({
      title: song.title,
      key: song.key,
      tempo: song.tempo,
      hasMusicSheet: !!(song.fileName && song.filePath)
    }))
  };
};
