const { contextBridge, ipcRenderer } = require('electron');

// OneDrive 경로 찾기 함수 (IPC로 메인 프로세스에 위임)
const findOneDrivePath = async () => {
  return await ipcRenderer.invoke('get-onedrive-path');
};

// Music_Sheets 경로 찾기 함수 (IPC로 메인 프로세스에 위임)
const findMusicSheetsPath = async () => {
  return await ipcRenderer.invoke('get-music-sheets-path');
};

// 파일 저장 함수 (IPC로 메인 프로세스에 위임)
const saveFile = async (fileData) => {
  return await ipcRenderer.invoke('save-file', fileData);
};

// 파일 읽기 함수 (IPC로 메인 프로세스에 위임)
const readFile = async (filePath) => {
  return await ipcRenderer.invoke('read-file', filePath);
};

// 파일 삭제 함수 (IPC로 메인 프로세스에 위임)
const deleteFile = async (filePath) => {
  return await ipcRenderer.invoke('delete-file', filePath);
};

// 디렉토리 생성 함수 (IPC로 메인 프로세스에 위임)
const createDirectory = async (dirPath) => {
  return await ipcRenderer.invoke('create-directory', dirPath);
};

// 파일 쓰기 함수 (IPC로 메인 프로세스에 위임)
const writeFile = async (filePath, data) => {
  return await ipcRenderer.invoke('write-file', filePath, data);
};

// PDF 저장 함수 (IPC로 메인 프로세스에 위임)
const savePdf = async (pdfData) => {
  return await ipcRenderer.invoke('save-pdf', pdfData);
};

// API를 렌더러 프로세스에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (fileData) => saveFile(fileData),
  getOneDrivePath: () => findOneDrivePath(),
  getMusicSheetsPath: () => findMusicSheetsPath(),
  readFile: (filePath) => readFile(filePath),
  deleteFile: (filePath) => deleteFile(filePath),
  createDirectory: (dirPath) => createDirectory(dirPath),
  writeFile: (filePath, data) => writeFile(filePath, data),
  savePdf: (pdfData) => savePdf(pdfData)
});
