#!/usr/bin/env node

const OneDrivePathFinder = require('./onedrive-utils');
const WorshipNoteBackup = require('./backup-script');
const WorshipNotePdfExport = require('./pdf-export-script');
const fs = require('fs').promises;
const path = require('path');

/**
 * WorshipNote 통합 관리 스크립트
 */
class WorshipNoteManager {
  constructor() {
    this.pathFinder = new OneDrivePathFinder();
    this.backup = new WorshipNoteBackup();
    this.pdfExport = new WorshipNotePdfExport();
  }

  /**
   * 도움말 출력
   */
  printHelp() {
    console.log(`
=== WorshipNote 관리 스크립트 ===

사용법:
  node worshipnote-manager.js [명령] [옵션]

명령:
  help                    - 이 도움말 출력
  info                    - OneDrive 경로 정보 출력
  backup                  - 데이터베이스 및 악보 파일 백업
  pdf [날짜]             - 특정 날짜의 찬양 리스트를 PDF로 내보내기
  pdf-all                - 모든 찬양 리스트를 PDF로 내보내기
  full                   - 백업 + PDF 내보내기 전체 실행

옵션:
  날짜 형식: YYYY-MM-DD (예: 2024-01-15)

예시:
  node worshipnote-manager.js info
  node worshipnote-manager.js backup
  node worshipnote-manager.js pdf 2024-01-15
  node worshipnote-manager.js pdf-all
  node worshipnote-manager.js full

OS 지원:
  - Windows: OneDrive, OneDrive - Personal, OneDrive - 회사명
  - macOS: Library/CloudStorage/OneDrive-Personal, Library/CloudStorage/OneDrive-회사명
  - Linux: OneDrive, Documents/OneDrive
`);
  }

  /**
   * 경로 정보 출력
   */
  async showInfo() {
    console.log('=== WorshipNote 경로 정보 ===\n');
    await this.pathFinder.printPathInfo();
  }

  /**
   * 백업 실행
   */
  async runBackup() {
    console.log('=== WorshipNote 백업 시작 ===\n');
    const result = await this.backup.runFullBackup();
    
    if (result.success) {
      console.log('\n✅ 백업이 성공적으로 완료되었습니다!');
      return true;
    } else {
      console.error('\n❌ 백업이 실패했습니다:', result.error);
      return false;
    }
  }

  /**
   * PDF 내보내기 실행
   */
  async runPdfExport(date = null) {
    console.log('=== WorshipNote PDF 내보내기 시작 ===\n');
    
    let result;
    if (date) {
      result = await this.pdfExport.exportPdfForDate(date);
    } else {
      result = await this.pdfExport.exportAllPdfs();
    }
    
    if (result.success) {
      console.log('\n✅ PDF 내보내기가 성공적으로 완료되었습니다!');
      if (result.filePath) {
        console.log(`📄 PDF 파일: ${result.filePath}`);
      }
      if (result.exported) {
        const successCount = result.exported.filter(r => r.success).length;
        console.log(`📊 내보내기 결과: ${successCount}/${result.exported.length}개 성공`);
      }
      return true;
    } else {
      console.error('\n❌ PDF 내보내기가 실패했습니다:', result.error);
      return false;
    }
  }

  /**
   * 전체 실행 (백업 + PDF 내보내기)
   */
  async runFull() {
    console.log('=== WorshipNote 전체 실행 시작 ===\n');
    
    // 1. 경로 정보 출력
    await this.showInfo();
    
    // 2. 백업 실행
    console.log('\n1단계: 백업 실행');
    const backupSuccess = await this.runBackup();
    if (!backupSuccess) {
      console.error('백업 실패로 인해 전체 실행을 중단합니다.');
      return false;
    }
    
    // 3. PDF 내보내기 실행
    console.log('\n2단계: PDF 내보내기 실행');
    const pdfSuccess = await this.runPdfExport();
    if (!pdfSuccess) {
      console.error('PDF 내보내기 실패로 인해 전체 실행을 중단합니다.');
      return false;
    }
    
    console.log('\n🎉 전체 실행이 성공적으로 완료되었습니다!');
    return true;
  }

  /**
   * 메인 실행 함수
   */
  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help') {
      this.printHelp();
      return;
    }
    
    const command = args[0];
    
    try {
      switch (command) {
        case 'info':
          await this.showInfo();
          break;
          
        case 'backup':
          await this.runBackup();
          break;
          
        case 'pdf':
          const date = args[1];
          if (!date) {
            console.error('❌ 날짜를 입력해주세요. 형식: YYYY-MM-DD');
            process.exit(1);
          }
          await this.runPdfExport(date);
          break;
          
        case 'pdf-all':
          await this.runPdfExport();
          break;
          
        case 'full':
          await this.runFull();
          break;
          
        default:
          console.error(`❌ 알 수 없는 명령입니다: ${command}`);
          this.printHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ 실행 중 오류가 발생했습니다:', error.message);
      process.exit(1);
    }
  }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  const manager = new WorshipNoteManager();
  manager.run()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 치명적인 오류:', error);
      process.exit(1);
    });
}

module.exports = WorshipNoteManager;
