const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * OS별 OneDrive 경로를 자동으로 찾는 클래스
 */
class OneDrivePathFinder {
  constructor() {
    this.platform = os.platform();
    this.homeDir = os.homedir();
  }

  /**
   * Windows에서 OneDrive 경로 찾기
   */
  async findWindowsOneDrivePath() {
    const possiblePaths = [
      path.join(this.homeDir, 'OneDrive'),
      path.join(this.homeDir, 'OneDrive - Personal'),
      path.join(this.homeDir, 'OneDrive - 회사명'),
      path.join(this.homeDir, 'Documents', 'OneDrive'),
    ];

    // 레지스트리에서 OneDrive 경로 확인 (Windows)
    try {
      const { stdout } = await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\OneDrive" /v "UserFolder"');
      const match = stdout.match(/UserFolder\s+REG_SZ\s+(.+)/);
      if (match) {
        const registryPath = match[1].trim();
        if (await this.pathExists(registryPath)) {
          return registryPath;
        }
      }
    } catch (error) {
      console.log('레지스트리에서 OneDrive 경로를 찾을 수 없습니다:', error.message);
    }

    // 환경변수에서 OneDrive 경로 확인
    const oneDriveEnv = process.env.ONEDRIVE;
    if (oneDriveEnv && await this.pathExists(oneDriveEnv)) {
      return oneDriveEnv;
    }

    // 가능한 경로들 확인
    for (const oneDrivePath of possiblePaths) {
      if (await this.pathExists(oneDrivePath)) {
        return oneDrivePath;
      }
    }

    return null;
  }

  /**
   * macOS에서 OneDrive 경로 찾기
   */
  async findMacOSOneDrivePath() {
    const possiblePaths = [
      path.join(this.homeDir, 'Library', 'CloudStorage', 'OneDrive-Personal'),
      path.join(this.homeDir, 'Library', 'CloudStorage', 'OneDrive-회사명'),
      path.join(this.homeDir, 'OneDrive'), // 심볼릭 링크
      path.join(this.homeDir, 'Documents', 'OneDrive'),
    ];

    // 가능한 경로들 확인
    for (const oneDrivePath of possiblePaths) {
      if (await this.pathExists(oneDrivePath)) {
        return oneDrivePath;
      }
    }

    return null;
  }

  /**
   * Linux에서 OneDrive 경로 찾기
   */
  async findLinuxOneDrivePath() {
    const possiblePaths = [
      path.join(this.homeDir, 'OneDrive'),
      path.join(this.homeDir, 'Documents', 'OneDrive'),
      path.join(this.homeDir, '.local', 'share', 'OneDrive'),
    ];

    // 가능한 경로들 확인
    for (const oneDrivePath of possiblePaths) {
      if (await this.pathExists(oneDrivePath)) {
        return oneDrivePath;
      }
    }

    return null;
  }

  /**
   * OS에 따라 OneDrive 경로 찾기
   */
  async findOneDrivePath() {
    console.log(`현재 OS: ${this.platform}`);
    
    let oneDrivePath = null;
    
    switch (this.platform) {
      case 'win32':
        oneDrivePath = await this.findWindowsOneDrivePath();
        break;
      case 'darwin':
        oneDrivePath = await this.findMacOSOneDrivePath();
        break;
      case 'linux':
        oneDrivePath = await this.findLinuxOneDrivePath();
        break;
      default:
        console.error('지원하지 않는 OS입니다:', this.platform);
        return null;
    }

    if (oneDrivePath) {
      console.log(`OneDrive 경로를 찾았습니다: ${oneDrivePath}`);
    } else {
      console.error('OneDrive 경로를 찾을 수 없습니다.');
    }

    return oneDrivePath;
  }

  /**
   * WorshipNote 데이터 경로 생성
   */
  async getWorshipNoteDataPath() {
    const oneDrivePath = await this.findOneDrivePath();
    if (!oneDrivePath) {
      return null;
    }

    const worshipNotePath = path.join(oneDrivePath, 'WorshipNote_Data');
    
    // 폴더가 없으면 생성
    if (!(await this.pathExists(worshipNotePath))) {
      try {
        await fs.mkdir(worshipNotePath, { recursive: true });
        console.log(`WorshipNote_Data 폴더를 생성했습니다: ${worshipNotePath}`);
      } catch (error) {
        console.error('WorshipNote_Data 폴더 생성 실패:', error.message);
        return null;
      }
    }

    return worshipNotePath;
  }

  /**
   * Music_Sheets 경로 생성
   */
  async getMusicSheetsPath() {
    const worshipNotePath = await this.getWorshipNoteDataPath();
    if (!worshipNotePath) {
      return null;
    }

    const musicSheetsPath = path.join(worshipNotePath, 'Music_Sheets');
    
    // 폴더가 없으면 생성
    if (!(await this.pathExists(musicSheetsPath))) {
      try {
        await fs.mkdir(musicSheetsPath, { recursive: true });
        console.log(`Music_Sheets 폴더를 생성했습니다: ${musicSheetsPath}`);
      } catch (error) {
        console.error('Music_Sheets 폴더 생성 실패:', error.message);
        return null;
      }
    }

    return musicSheetsPath;
  }

  /**
   * PDF 저장 경로 생성
   */
  async getPdfSavePath() {
    const oneDrivePath = await this.findOneDrivePath();
    if (!oneDrivePath) {
      return null;
    }

    const pdfPath = path.join(oneDrivePath, 'Documents', 'Archive', '한소망교회', '찬양 리스트', '찬양리스트모음');
    
    // 폴더가 없으면 생성
    if (!(await this.pathExists(pdfPath))) {
      try {
        await fs.mkdir(pdfPath, { recursive: true });
        console.log(`PDF 저장 폴더를 생성했습니다: ${pdfPath}`);
      } catch (error) {
        console.error('PDF 저장 폴더 생성 실패:', error.message);
        return null;
      }
    }

    return pdfPath;
  }

  /**
   * 경로 존재 여부 확인
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 경로 정보 출력
   */
  async printPathInfo() {
    console.log('\n=== OneDrive 경로 정보 ===');
    
    const oneDrivePath = await this.findOneDrivePath();
    if (oneDrivePath) {
      console.log(`OneDrive 경로: ${oneDrivePath}`);
      
      const worshipNotePath = await this.getWorshipNoteDataPath();
      if (worshipNotePath) {
        console.log(`WorshipNote_Data 경로: ${worshipNotePath}`);
        
        const musicSheetsPath = await this.getMusicSheetsPath();
        if (musicSheetsPath) {
          console.log(`Music_Sheets 경로: ${musicSheetsPath}`);
        }
        
        const pdfPath = await this.getPdfSavePath();
        if (pdfPath) {
          console.log(`PDF 저장 경로: ${pdfPath}`);
        }
      }
    }
    
    console.log('========================\n');
  }
}

module.exports = OneDrivePathFinder;
