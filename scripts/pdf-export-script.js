const OneDrivePathFinder = require('./onedrive-utils');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * WorshipNote PDF 내보내기 스크립트
 */
class WorshipNotePdfExport {
  constructor() {
    this.pathFinder = new OneDrivePathFinder();
  }

  /**
   * 찬양 리스트 데이터 로드
   */
  async loadWorshipListData() {
    try {
      const projectRoot = path.join(__dirname, '..');
      const dataJsonPath = path.join(projectRoot, 'public', 'data.json');
      
      if (!(await this.pathFinder.pathExists(dataJsonPath))) {
        throw new Error('data.json 파일을 찾을 수 없습니다.');
      }

      const data = await fs.readFile(dataJsonPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      return jsonData;
    } catch (error) {
      console.error('찬양 리스트 데이터 로드 실패:', error.message);
      return null;
    }
  }

  /**
   * 특정 날짜의 찬양 리스트 가져오기
   */
  getWorshipListForDate(worshipLists, date) {
    // date가 이미 YYYY-MM-DD 형식의 문자열이므로 그대로 사용
    const dateKey = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return worshipLists[dateKey] || [];
  }

  /**
   * 악보 파일이 있는 찬양만 필터링
   */
  filterSongsWithMusicSheets(songs) {
    return songs.filter(song => song.fileName && song.filePath);
  }

  /**
   * PDF 파일명 생성
   */
  generatePdfFileName(date) {
    // YYYY-MM-DD 형식의 문자열을 직접 파싱하여 시간대 문제 방지
    const [year, month, day] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayOfWeek = dateObj.getDay();
    
    const serviceType = dayOfWeek === 5 ? '금요기도회' : '주일예배';
    return `${year}${month}${day} ${serviceType} 찬양 리스트.pdf`;
  }

  /**
   * 이미지 파일을 Base64로 변환
   */
  async imageToBase64(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error(`이미지 파일 읽기 실패 (${imagePath}):`, error.message);
      return null;
    }
  }

  /**
   * PDF 생성 (jsPDF 사용)
   */
  async generatePdf(songs, date) {
    try {
      // jsPDF require (Node.js 환경)
      const { jsPDF } = require('jspdf');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });

      const pageWidth = 8.5;
      const pageHeight = 11;
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
            // 파일 경로를 현재 플랫폼에 맞게 변환
            const musicSheetsPath = await this.pathFinder.getMusicSheetsPath();
            if (!musicSheetsPath) {
              console.warn(`Music_Sheets 경로를 찾을 수 없습니다: ${song.fileName}`);
              continue;
            }

            const fileName = song.filePath.split('/').pop() || song.filePath.split('\\').pop();
            const imagePath = path.join(musicSheetsPath, fileName);
            
            if (!(await this.pathFinder.pathExists(imagePath))) {
              console.warn(`이미지 파일을 찾을 수 없습니다: ${imagePath}`);
              continue;
            }

            // 이미지를 Base64로 변환
            const base64 = await this.imageToBase64(imagePath);
            if (!base64) {
              console.warn(`이미지 변환 실패: ${song.fileName}`);
              continue;
            }

            // Node.js 환경에서 이미지 크기 가져오기
            const sharp = require('sharp');
            const imageInfo = await sharp(imagePath).metadata();
            const imgWidth = imageInfo.width;
            const imgHeight = imageInfo.height;

            // 이미지 비율 유지하면서 최대 크기 계산
            const imgAspectRatio = imgWidth / imgHeight;
            const contentAspectRatio = contentWidth / contentHeight;
            
            let finalImgWidth, finalImgHeight;
            if (imgAspectRatio > contentAspectRatio) {
              finalImgWidth = contentWidth;
              finalImgHeight = contentWidth / imgAspectRatio;
            } else {
              finalImgHeight = contentHeight;
              finalImgWidth = contentHeight * imgAspectRatio;
            }

            // 이미지를 페이지 중간 위쪽에 배치
            const x = margin + (contentWidth - finalImgWidth) / 2;
            const y = currentY + (contentHeight - finalImgHeight) / 2 - 0.5;

            // 이미지를 PDF에 추가
            pdf.addImage(base64, 'JPEG', x, y, finalImgWidth, finalImgHeight);

            // 다음 이미지를 위해 Y 위치 업데이트
            currentY += finalImgHeight + 0.2;

            console.log(`PDF에 추가됨: ${song.title} (${song.fileName})`);

          } catch (error) {
            console.error(`이미지 처리 실패 (${song.fileName}):`, error.message);
            continue;
          }
        }
      }

      return pdf;
    } catch (error) {
      console.error('PDF 생성 실패:', error.message);
      throw error;
    }
  }

  /**
   * 특정 날짜의 찬양 리스트를 PDF로 내보내기
   */
  async exportPdfForDate(date) {
    console.log(`PDF 내보내기를 시작합니다: ${date}`);
    
    try {
      // 데이터 로드
      const data = await this.loadWorshipListData();
      if (!data) {
        throw new Error('찬양 리스트 데이터를 로드할 수 없습니다.');
      }

      // 해당 날짜의 찬양 리스트 가져오기 (date는 이미 YYYY-MM-DD 형식의 문자열)
      const worshipList = this.getWorshipListForDate(data.worshipLists || {}, date);
      if (worshipList.length === 0) {
        throw new Error(`해당 날짜(${date})에 찬양 리스트가 없습니다.`);
      }

      // 악보가 있는 찬양만 필터링
      const songsWithMusicSheets = this.filterSongsWithMusicSheets(worshipList);
      if (songsWithMusicSheets.length === 0) {
        throw new Error(`해당 날짜(${date})에 악보가 있는 찬양이 없습니다.`);
      }

      console.log(`총 ${songsWithMusicSheets.length}개의 찬양을 PDF로 내보냅니다.`);

      // PDF 생성
      const pdf = await this.generatePdf(songsWithMusicSheets, date);

      // PDF 저장 경로 생성
      const pdfSavePath = await this.pathFinder.getPdfSavePath();
      if (!pdfSavePath) {
        throw new Error('PDF 저장 경로를 찾을 수 없습니다.');
      }

      const fileName = this.generatePdfFileName(date);
      const fullPath = path.join(pdfSavePath, fileName);

      // PDF 저장
      const pdfBuffer = pdf.output('arraybuffer');
      await fs.writeFile(fullPath, Buffer.from(pdfBuffer));

      console.log(`PDF 내보내기 완료: ${fullPath}`);
      
      return {
        success: true,
        filePath: fullPath,
        fileName: fileName,
        songCount: songsWithMusicSheets.length
      };

    } catch (error) {
      console.error('PDF 내보내기 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 모든 찬양 리스트를 PDF로 내보내기
   */
  async exportAllPdfs() {
    console.log('모든 찬양 리스트 PDF 내보내기를 시작합니다...');
    
    try {
      // 데이터 로드
      const data = await this.loadWorshipListData();
      if (!data) {
        throw new Error('찬양 리스트 데이터를 로드할 수 없습니다.');
      }

      const worshipLists = data.worshipLists || {};
      const dates = Object.keys(worshipLists).sort();
      
      if (dates.length === 0) {
        console.log('내보낼 찬양 리스트가 없습니다.');
        return { success: true, exported: [] };
      }

      const results = [];
      
      for (const date of dates) {
        const result = await this.exportPdfForDate(date);
        results.push({ date, ...result });
        
        if (result.success) {
          console.log(`✓ ${date}: ${result.fileName} (${result.songCount}곡)`);
        } else {
          console.log(`✗ ${date}: ${result.error}`);
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`\nPDF 내보내기 완료: ${successCount}/${dates.length}개 성공`);
      
      return {
        success: true,
        exported: results
      };

    } catch (error) {
      console.error('전체 PDF 내보내기 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  const pdfExport = new WorshipNotePdfExport();
  
  // 명령행 인수 확인
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 모든 PDF 내보내기
    pdfExport.exportAllPdfs()
      .then(result => {
        if (result.success) {
          console.log('\n모든 PDF 내보내기가 완료되었습니다!');
          process.exit(0);
        } else {
          console.error('\nPDF 내보내기가 실패했습니다.');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('PDF 내보내기 실행 중 오류:', error);
        process.exit(1);
      });
  } else {
    // 특정 날짜 PDF 내보내기
    const date = args[0];
    pdfExport.exportPdfForDate(date)
      .then(result => {
        if (result.success) {
          console.log('\nPDF 내보내기가 완료되었습니다!');
          process.exit(0);
        } else {
          console.error('\nPDF 내보내기가 실패했습니다.');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('PDF 내보내기 실행 중 오류:', error);
        process.exit(1);
      });
  }
}

module.exports = WorshipNotePdfExport;
