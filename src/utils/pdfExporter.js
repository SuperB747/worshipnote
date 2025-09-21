import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as pdfjsLib from 'pdfjs-dist';
import { checkFileExists } from './storage';

// OneDrive 경로 찾기 함수
const findOneDrivePath = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.getOneDrivePath) {
      return null;
    }
    return await window.electronAPI.getOneDrivePath();
  } catch (error) {
    return null;
  }
};

// Music_Sheets 경로 찾기 함수
const findMusicSheetsPath = async () => {
  try {
    if (!window.electronAPI || !window.electronAPI.getMusicSheetsPath) {
      return null;
    }
    const path = await window.electronAPI.getMusicSheetsPath();
    return path;
  } catch (error) {
    return null;
  }
};

// checkFileExists 함수는 storage.js에서 import

// Music_Sheets 디렉토리의 파일 목록 확인 함수
const listMusicSheetsFiles = async () => {
  try {
    const musicSheetsPath = await findMusicSheetsPath();
    if (!musicSheetsPath) {
      return [];
    }
    
    // Electron API를 통해 디렉토리 목록을 가져오는 함수가 있는지 확인
    if (window.electronAPI && window.electronAPI.listFiles) {
      try {
        const files = await window.electronAPI.listFiles(musicSheetsPath);
        return files;
      } catch (error) {
        // 디렉토리 목록 가져오기 실패 시 빈 배열 반환
      }
    }
    
    // 디렉토리 목록 API가 없으면 빈 배열 반환
    return [];
  } catch (error) {
    return [];
  }
};

// 파일 경로를 현재 플랫폼에 맞게 변환하는 함수
const convertFilePathToCurrentPlatform = async (originalFilePath) => {
  try {
    // Music_Sheets 경로 가져오기
    const musicSheetsPath = await findMusicSheetsPath();
    if (!musicSheetsPath) {
      return null;
    }

    // 원본 파일 경로에서 파일명만 추출
    const fileName = originalFilePath.split('/').pop() || originalFilePath.split('\\').pop();
    if (!fileName) {
      return null;
    }

    // 현재 플랫폼의 Music_Sheets 경로와 파일명을 결합
    // 맥OS에서는 '/' 사용, Windows에서는 '\' 사용
    const pathSeparator = musicSheetsPath.includes('\\') ? '\\' : '/';
    const currentPlatformPath = `${musicSheetsPath}${musicSheetsPath.endsWith(pathSeparator) ? '' : pathSeparator}${fileName}`;
    
    return currentPlatformPath;
  } catch (error) {
    return null;
  }
};


// PDF 저장 경로 생성
const getPdfSavePath = async (date) => {
  // date 매개변수 유효성 검사
  if (!date || typeof date !== 'string') {
    throw new Error('유효하지 않은 날짜입니다. 날짜는 YYYY-MM-DD 형식의 문자열이어야 합니다.');
  }

  // YYYY-MM-DD 형식 검증
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.');
  }

  const oneDrivePath = await findOneDrivePath();
  if (!oneDrivePath) {
    throw new Error('OneDrive 경로를 찾을 수 없습니다.');
  }

  // YYYY-MM-DD 형식의 문자열을 직접 파싱하여 시간대 문제 방지
  const [year, month, day] = date.split('-');
  
  // 날짜 구성 요소 유효성 검사
  if (!year || !month || !day || isNaN(parseInt(year)) || isNaN(parseInt(month)) || isNaN(parseInt(day))) {
    throw new Error('날짜 구성 요소가 유효하지 않습니다.');
  }

  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  // 생성된 Date 객체가 유효한지 확인
  if (isNaN(dateObj.getTime())) {
    throw new Error('유효하지 않은 날짜입니다.');
  }

  const dayOfWeek = dateObj.getDay(); // 0=일요일, 5=금요일

  // 요일별 파일명 설정
  const serviceType = dayOfWeek === 5 ? '금요기도회' : '주일예배';
  const fileName = `${year}${month}${day} ${serviceType} 찬양악보.pdf`;

  // OneDrive 경로 구성 (수동으로 경로 구분자 처리)
  const pathSeparator = oneDrivePath.includes('\\') ? '\\' : '/';
  const pdfPath = `${oneDrivePath}${pathSeparator}Documents${pathSeparator}Archive${pathSeparator}한소망교회${pathSeparator}찬양 리스트${pathSeparator}찬양리스트모음${pathSeparator}${fileName}`;
  
  return pdfPath;
};

// Electron을 통해 이미지 파일을 읽어서 Blob으로 변환
const imageFileToBlob = async (filePath) => {
  try {
    console.log('imageFileToBlob 시작, filePath:', filePath);
    
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI || !window.electronAPI.readFile) {
      throw new Error('Electron API를 사용할 수 없습니다.');
    }

    // filePath가 이미 전체 경로인지 확인
    let finalFilePath = filePath;
    
    // macOS 경로가 포함되어 있으면 Windows 경로로 변환
    if (filePath.includes('/Users/') || filePath.includes('OneDrive-Personal')) {
      console.log('경로 변환 시도 중...');
      const convertedFilePath = await convertFilePathToCurrentPlatform(filePath);
      if (convertedFilePath) {
        finalFilePath = convertedFilePath;
        console.log('경로 변환 완료:', finalFilePath);
      }
    }

    console.log('최종 파일 경로:', finalFilePath);

    // 파일 존재 여부 확인을 위해 먼저 읽기 시도
    try {
      console.log('파일 읽기 시도 중...');
      const fileData = await window.electronAPI.readFile(finalFilePath);
      
      if (!fileData) {
        throw new Error('파일을 읽을 수 없습니다.');
      }
      
      console.log('파일 읽기 성공, 원본 데이터:', fileData);
      console.log('데이터 타입:', typeof fileData);
      console.log('데이터 constructor:', fileData.constructor.name);
      
      // fileData가 ArrayBuffer가 아닌 경우 변환
      let actualData = fileData;
      if (fileData && typeof fileData === 'object' && fileData.success && fileData.data) {
        // electron.js에서 반환하는 형태: { success: true, data: ArrayBuffer, fileName: string }
        actualData = fileData.data;
        console.log('데이터 추출 완료, 크기:', actualData.byteLength, 'bytes');
      } else if (fileData && fileData.byteLength !== undefined) {
        // 이미 ArrayBuffer인 경우
        actualData = fileData;
        console.log('ArrayBuffer 직접 사용, 크기:', actualData.byteLength, 'bytes');
      } else {
        console.error('지원하지 않는 데이터 형식:', fileData);
        throw new Error('파일 데이터 형식이 올바르지 않습니다.');
      }

      // 파일 확장자에 따라 MIME 타입 결정
      const extension = finalFilePath.toLowerCase().split('.').pop();
      let mimeType = 'image/jpeg'; // 기본값
      
      console.log('파일 확장자:', extension);
      
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'pdf':
          console.log('PDF 파일 감지, 이미지로 변환 시도...');
          // PDF 파일은 이미지로 변환하여 처리
          try {
            const convertedBlob = await convertPDFToImage(actualData);
            if (convertedBlob) {
              console.log('PDF를 이미지로 변환 성공');
              return convertedBlob;
            } else {
              console.log('PDF를 이미지로 변환 실패');
              return null;
            }
          } catch (conversionError) {
            console.error('PDF 변환 오류:', conversionError);
            return null;
          }
        default:
          console.log('알 수 없는 확장자, JPEG로 처리');
          // 알 수 없는 파일 확장자는 JPEG로 처리
      }

      console.log('MIME 타입:', mimeType);

      // Buffer를 Blob으로 변환
      const blob = new Blob([actualData], { type: mimeType });
      console.log('Blob 생성 완료, 크기:', blob.size, 'bytes');
      
      return blob;
    } catch (readError) {
      // 파일이 존재하지 않거나 접근할 수 없는 경우
      if (readError.message.includes('ENOENT') || readError.message.includes('파일을 읽을 수 없습니다')) {
        return null;
      }
      throw readError;
    }
  } catch (error) {
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

// PDF를 이미지로 변환하는 함수
const convertPDFToImage = async (pdfData) => {
  try {
    // PDF.js를 사용하여 PDF 로드
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    
    // 첫 번째 페이지만 변환 (악보는 보통 첫 페이지만 필요)
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // 적당한 해상도로 변환
    
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
    
    // Canvas를 Blob으로 변환 (적당한 품질)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.8); // 적당한 품질로 설정
    });
  } catch (error) {
    return null;
  }
};

// PDF 생성 함수
export const generateWorshipListPDF = async (songs, date) => {
  try {
    // 매개변수 유효성 검사
    if (!songs || !Array.isArray(songs)) {
      throw new Error('songs 매개변수가 유효하지 않습니다.');
    }
    
    if (!date || typeof date !== 'string') {
      throw new Error('date 매개변수가 유효하지 않습니다. YYYY-MM-DD 형식의 문자열이어야 합니다.');
    }
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });

    // 레터 사이즈: 8.5 x 11 인치
    const pageWidth = 8.5;
    const pageHeight = 11;
    
    // 적당한 여백 설정 (0.5인치)
    const margin = 0.5;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    let currentY = margin;
    let isFirstPage = true;
    let successCount = 0;
    let failCount = 0;
    const failedSongs = [];

    // Music_Sheets 디렉토리 파일 목록 확인
    const musicSheetsFiles = await listMusicSheetsFiles();
    console.log('Music_Sheets 파일 목록:', musicSheetsFiles);

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      console.log(`\n=== 곡 ${i + 1}/${songs.length} 처리 중: ${song.title} ===`);
      
      // 각 곡마다 새 페이지 시작 (첫 번째 곡이 아닌 경우)
      if (!isFirstPage) {
        pdf.addPage();
        currentY = margin;
      }
      isFirstPage = false;

      // filePath 변수 선언 (스코프 문제 해결)
      let filePath = null;
      
      // 악보 파일이 있는 경우에만 처리
      if (song.fileName) {
        // filePath 구성 - 플랫폼별 경로 문제 해결
        const musicSheetsPath = await findMusicSheetsPath();
        
        if (!musicSheetsPath) {
          failCount++;
          failedSongs.push({
            title: song.title,
            fileName: song.fileName,
            error: 'Music_Sheets 경로를 찾을 수 없습니다.'
          });
          continue;
        }
        
        if (song.filePath) {
          // filePath가 있고 다른 플랫폼 경로인 경우, 현재 플랫폼에 맞게 변환
          const isWindowsPath = /^[A-Za-z]:[\\/]/.test(song.filePath) || song.filePath.includes('\\');
          const isMacPath = song.filePath.startsWith('/') && !song.filePath.includes('\\');
          
          if (isWindowsPath) {
            // Windows 경로를 현재 플랫폼 경로로 변환
            const fileName = song.fileName || song.filePath.split(/[\\/]/).pop();
            filePath = `${musicSheetsPath}/${fileName}`;
          } else if (isMacPath) {
            // macOS 경로이지만 다른 위치인 경우, 현재 musicSheetsPath 사용
            const fileName = song.fileName || song.filePath.split('/').pop();
            filePath = `${musicSheetsPath}/${fileName}`;
          } else {
            // 상대 경로인 경우
            filePath = `${musicSheetsPath}/${song.filePath}`;
          }
        } else {
          // filePath가 없는 경우 fileName 사용
          filePath = `${musicSheetsPath}/${song.fileName}`;
        }
        
        // 파일 존재 여부 확인
        let fileExists = await checkFileExists(filePath);
        if (!fileExists) {
          // Music_Sheets 디렉토리에서 비슷한 파일명 찾기
          const fileNameWithoutExt = song.fileName.toLowerCase().split('.')[0];
          
          const similarFiles = musicSheetsFiles.filter(file => {
            const fileWithoutExt = file.toLowerCase().split('.')[0];
            return fileWithoutExt.includes(fileNameWithoutExt) || 
                   fileNameWithoutExt.includes(fileWithoutExt) ||
                   file.toLowerCase().includes(fileNameWithoutExt);
          });
          
          if (similarFiles.length > 0) {
            // 첫 번째 비슷한 파일로 시도
            const newFilePath = `${musicSheetsPath}/${similarFiles[0]}`;
            filePath = newFilePath;
            fileExists = await checkFileExists(filePath);
          }
        }
        
        if (!fileExists) {
          failCount++;
          failedSongs.push({
            title: song.title,
            fileName: song.fileName,
            error: `파일을 찾을 수 없습니다: ${filePath}`
          });
          continue;
        }
      } else {
        failCount++;
        failedSongs.push({
          title: song.title,
          fileName: song.fileName || '없음',
          error: '악보 파일명이 없습니다.'
        });
        continue;
      }
      
      try {
        if (!filePath) {
          throw new Error('파일 경로가 설정되지 않았습니다.');
        }
        
        console.log('파일 경로:', filePath);
        
        // Electron을 통해 이미지 파일을 Blob으로 로드 (재시도 로직 포함)
        let blob = null;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (!blob && retryCount <= maxRetries) {
          if (retryCount > 0) {
            // 재시도 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          console.log(`이미지 로드 시도 ${retryCount + 1}/${maxRetries + 1}`);
          blob = await imageFileToBlob(filePath);
          retryCount++;
        }
        
        if (!blob) {
          throw new Error('이미지 파일을 로드할 수 없습니다.');
        }
        
        console.log('이미지 Blob 로드 성공, 크기:', blob.size, 'bytes');

        // Blob을 Base64로 변환
        const base64 = await blobToBase64(blob);
        console.log('Base64 변환 완료, 길이:', base64.length);
        
        // 이미지 로드
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('이미지 로드 성공, 크기:', img.width, 'x', img.height);
            resolve();
          };
          img.onerror = (error) => {
            console.error('이미지 로드 실패:', error);
            reject(error);
          };
          img.src = base64;
        });

        // 이미지 비율 유지하면서 페이지에 꽉 차게 조정
        const imgAspectRatio = img.width / img.height;
        const contentAspectRatio = contentWidth / contentHeight;
        
        let imgWidth, imgHeight;
        if (imgAspectRatio > contentAspectRatio) {
          // 이미지가 더 넓음 - 너비를 기준으로 페이지에 꽉 차게
          imgWidth = contentWidth;
          imgHeight = contentWidth / imgAspectRatio;
        } else {
          // 이미지가 더 높음 - 높이를 기준으로 페이지에 꽉 차게
          imgHeight = contentHeight;
          imgWidth = contentHeight * imgAspectRatio;
        }

        console.log('계산된 이미지 크기:', imgWidth, 'x', imgHeight);

        // 이미지를 페이지 윗쪽 중간에 배치
        const x = margin + (contentWidth - imgWidth) / 2;
        const y = margin; // 페이지 윗쪽에 배치
        
        console.log('이미지 위치:', x, y);
        
        // 이미지를 PDF에 추가
        pdf.addImage(base64, 'JPEG', x, y, imgWidth, imgHeight);
        console.log('PDF에 이미지 추가 완료');
        successCount++;

      } catch (error) {
        failCount++;
        failedSongs.push({
          title: song.title,
          fileName: song.fileName,
          error: error.message
        });
        continue;
      }
    }

    // PDF에 이미지가 있는지 확인
    if (successCount === 0) {
      // 빈 PDF에 최소한의 텍스트라도 추가
      pdf.setFontSize(16);
      pdf.text('찬양악보', 4.25, 5.5, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text(`날짜: ${date}`, 4.25, 6, { align: 'center' });
      pdf.text('악보 파일을 찾을 수 없습니다.', 4.25, 6.5, { align: 'center' });
    }

    // PDF 저장
    const pdfPath = await getPdfSavePath(date);
    console.log('PDF 저장 경로:', pdfPath);
    
    // 파일 존재 여부 확인 및 덮어쓰기는 Electron main process에서 처리
    
    const pdfArrayBuffer = pdf.output('arraybuffer');
    const pdfUint8Array = new Uint8Array(pdfArrayBuffer);
    
    // Electron을 통해 파일 저장
    if (!window.electronAPI || !window.electronAPI.savePdf) {
      throw new Error('Electron API를 사용할 수 없습니다.');
    }

    // PDF 경로에서 파일명과 폴더 경로 분리
    const pathSeparator = pdfPath.includes('\\') ? '\\' : '/';
    const pathParts = pdfPath.split(pathSeparator);
    const fileName = pathParts.pop();
    const folderPath = pathParts.join(pathSeparator);
    
    // pathSeparator가 빈 문자열인 경우 기본값 설정
    const actualPathSeparator = pathSeparator || '/';
    
    console.log('분리된 경로 정보:');
    console.log('- fileName:', fileName);
    console.log('- folderPath:', folderPath);
    console.log('- pathSeparator:', pathSeparator);
    
    // folderPath가 비어있으면 현재 디렉토리로 설정
    if (!folderPath) {
      throw new Error('PDF 저장 경로를 생성할 수 없습니다.');
    }
    
    const result = await window.electronAPI.savePdf({
      arrayBuffer: pdfUint8Array,
      fileName: fileName,
      folderPath: folderPath
    });
    
    if (result.success) {
      let message = `PDF 변환이 완료되었습니다!\n`;
      message += `📄 악보 페이지 수: ${successCount}페이지\n`;
      message += `📂 파일이름: ${pdfPath.split(/[\\/]/).pop()}`;

      return {
        success: true,
        message: message,
        filePath: pdfPath,
        stats: {
          total: songs.length,
          success: successCount,
          failed: failCount,
          failedSongs: failedSongs
        }
      };
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
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