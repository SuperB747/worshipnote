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

// 파일명 변경 함수 (IPC로 메인 프로세스에 위임)
const renameFile = async (oldFilePath, newFilePath) => {
  return await ipcRenderer.invoke('rename-file', oldFilePath, newFilePath);
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

// 파일 열기 함수 (IPC로 메인 프로세스에 위임)
const openFile = async (filePath) => {
  return await ipcRenderer.invoke('open-file', filePath);
};

// PDF를 JPG로 변환하는 함수 (IPC로 메인 프로세스에 위임)
const convertPDFToJPG = async (uint8Array, fileName) => {
  return await ipcRenderer.invoke('convert-pdf-to-jpg', uint8Array, fileName);
};


// API를 렌더러 프로세스에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (fileData) => saveFile(fileData),
  getOneDrivePath: () => findOneDrivePath(),
  getMusicSheetsPath: () => findMusicSheetsPath(),
  readFile: (filePath) => readFile(filePath),
  deleteFile: (filePath) => deleteFile(filePath),
  renameFile: (oldFilePath, newFilePath) => renameFile(oldFilePath, newFilePath),
  createDirectory: (dirPath) => createDirectory(dirPath),
  writeFile: (filePath, data) => writeFile(filePath, data),
  savePdf: (pdfData) => savePdf(pdfData),
  openFile: (filePath) => openFile(filePath),
  convertPDFToJPG: (file, fileName) => convertPDFToJPG(file, fileName)
});
