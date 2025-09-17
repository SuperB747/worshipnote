const OneDrivePathFinder = require('./onedrive-utils');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * WorshipNote 데이터 백업 스크립트
 */
class WorshipNoteBackup {
  constructor() {
    this.pathFinder = new OneDrivePathFinder();
  }

  /**
   * 데이터베이스 파일 백업
   */
  async backupDatabase() {
    console.log('데이터베이스 백업을 시작합니다...');
    
    try {
      const worshipNotePath = await this.pathFinder.getWorshipNoteDataPath();
      if (!worshipNotePath) {
        throw new Error('WorshipNote_Data 경로를 찾을 수 없습니다.');
      }

      const backupPath = path.join(worshipNotePath, 'Backups');
      await fs.mkdir(backupPath, { recursive: true });

      // 현재 프로젝트의 data.json 파일 찾기
      const projectRoot = path.join(__dirname, '..');
      const dataJsonPath = path.join(projectRoot, 'public', 'data.json');
      
      if (await this.pathFinder.pathExists(dataJsonPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `worshipnote_database_${timestamp}.json`;
        const backupFilePath = path.join(backupPath, backupFileName);
        
        await fs.copyFile(dataJsonPath, backupFilePath);
        console.log(`데이터베이스 백업 완료: ${backupFilePath}`);
        
        // 오래된 백업 파일 정리 (30일 이상 된 파일 삭제)
        await this.cleanOldBackups(backupPath);
        
        return backupFilePath;
      } else {
        console.log('data.json 파일을 찾을 수 없습니다.');
        return null;
      }
    } catch (error) {
      console.error('데이터베이스 백업 실패:', error.message);
      return null;
    }
  }

  /**
   * 악보 파일 백업 (사용하지 않음 - 데이터베이스만 백업)
   */
  async backupMusicSheets() {
    console.log('악보 파일 백업은 지원하지 않습니다. 데이터베이스만 백업합니다.');
    return [];
  }

  /**
   * 전체 백업 실행 (데이터베이스만)
   */
  async runFullBackup() {
    console.log('=== WorshipNote 데이터베이스 백업 시작 ===\n');
    
    try {
      // 경로 정보 출력
      await this.pathFinder.printPathInfo();
      
      // 데이터베이스 백업만 실행
      const dbBackup = await this.backupDatabase();
      
      console.log('\n=== 백업 완료 ===');
      console.log(`데이터베이스 백업: ${dbBackup ? '성공' : '실패'}`);
      
      return {
        success: true,
        databaseBackup: dbBackup
      };
    } catch (error) {
      console.error('백업 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 오래된 백업 파일 정리 (30일 이상)
   */
  async cleanOldBackups(backupPath) {
    try {
      const files = await fs.readdir(backupPath);
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.startsWith('worshipnote_database_') && file.endsWith('.json')) {
          const filePath = path.join(backupPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < thirtyDaysAgo) {
            await fs.unlink(filePath);
            console.log(`오래된 백업 파일 삭제: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('백업 파일 정리 실패:', error.message);
    }
  }

  /**
   * 오래된 백업 폴더 정리 (30일 이상)
   */
  async cleanOldBackupFolders(backupPath) {
    try {
      const folders = await fs.readdir(backupPath);
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const folder of folders) {
        if (folder.startsWith('music-sheets-')) {
          const folderPath = path.join(backupPath, folder);
          const stats = await fs.stat(folderPath);
          
          if (stats.isDirectory() && stats.mtime.getTime() < thirtyDaysAgo) {
            await fs.rmdir(folderPath, { recursive: true });
            console.log(`오래된 백업 폴더 삭제: ${folder}`);
          }
        }
      }
    } catch (error) {
      console.error('백업 폴더 정리 실패:', error.message);
    }
  }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  const backup = new WorshipNoteBackup();
  backup.runFullBackup()
    .then(result => {
      if (result.success) {
        console.log('\n백업이 성공적으로 완료되었습니다!');
        process.exit(0);
      } else {
        console.error('\n백업이 실패했습니다.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('백업 실행 중 오류:', error);
      process.exit(1);
    });
}

module.exports = WorshipNoteBackup;
