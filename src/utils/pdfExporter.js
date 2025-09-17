import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// OneDrive 경로 찾기 함수
const findOneDrivePath = () => {
  const { ipcRenderer } = window.electronAPI;
  if (ipcRenderer) {
    return ipcRenderer.invoke('find-one-drive-path');
  }
  return null;
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

  // OneDrive 경로 구성
  const pdfPath = `${oneDrivePath}/Documents/Archive/한소망교회/찬양 리스트/찬양리스트모음/${fileName}`;
  
  return pdfPath;
};

// 이미지 URL을 Blob으로 변환
const imageUrlToBlob = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return blob;
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
          // 이미지 URL 생성 (Electron의 file:// 프로토콜 사용)
          const imageUrl = `file://${song.filePath}`;
          
          // 이미지를 Blob으로 로드
          const blob = await imageUrlToBlob(imageUrl);
          if (!blob) {
            console.warn(`이미지 로드 실패: ${song.fileName}`);
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

    // PDF 저장
    const pdfPath = await getPdfSavePath(date);
    const pdfBlob = pdf.output('blob');
    
    // Electron을 통해 파일 저장
    const { ipcRenderer } = window.electronAPI;
    if (ipcRenderer) {
      const result = await ipcRenderer.invoke('save-pdf', {
        pdfBlob: pdfBlob,
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
    } else {
      throw new Error('Electron API를 사용할 수 없습니다.');
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
