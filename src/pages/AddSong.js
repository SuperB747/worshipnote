import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Upload, Music, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { processFileUpload } from '../utils/fileConverter';
import GhibliDialog from '../components/GhibliDialog';
import './AddSong.css';

const AddSong = ({ songs, setSongs, setSelectedSong }) => {
  const titleInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    id: null, // 임시 ID 저장
    title: '',
    firstLyrics: '',
    chord: 'C',
    tempo: 'Medium',
    fileName: '',
    filePath: ''
  });
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    success: false,
    error: null,
    message: ''
  });
  const [dialog, setDialog] = useState({ isVisible: false, type: 'success', message: '' });
  const [isDragOver, setIsDragOver] = useState(false);

  const keys = ['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Em', 'Eb', 'F', 'G'];
  const tempos = ['Fast', 'Medium', 'Slow'];

  // 컴포넌트 마운트 시 입력 필드 포커스
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  // 파일 업로드 핸들러 (드래그 앤 드롭에서 사용하기 위해 먼저 정의)
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadStatus({
        isUploading: false,
        success: false,
        error: 'JPG, PNG, GIF 파일만 업로드할 수 있습니다.',
        message: ''
      });
      return;
    }

    // 찬양 이름과 코드가 모두 입력되지 않았으면 경고
    if (!formData.title.trim() || !formData.chord.trim()) {
      setUploadStatus({
        isUploading: false,
        success: false,
        error: '먼저 찬양 이름과 코드를 입력해주세요.',
        message: ''
      });
      return;
    }

    setUploadStatus({
      isUploading: true,
      success: false,
      error: null,
      message: ''
    });

    try {
      // ID가 없으면 생성
      const songId = formData.id || Date.now().toString();
      
      // ID가 새로 생성된 경우 formData 업데이트
      if (!formData.id) {
        setFormData(prev => ({
          ...prev,
          id: songId
        }));
      }
      
      const result = await processFileUpload(file, songId, formData.title, formData.chord);
      
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          fileName: result.fileName,
          filePath: result.filePath
        }));

        setUploadStatus({
          isUploading: false,
          success: true,
          error: null,
          message: result.skipped ? 
            `기존 파일과 연동되었습니다: ${result.fileName}` : 
            result.message
        });
      } else {
        setUploadStatus({
          isUploading: false,
          success: false,
          error: result.error,
          message: ''
        });
      }
    } catch (error) {
      setUploadStatus({
        isUploading: false,
        success: false,
        error: '파일 처리 중 오류가 발생했습니다.',
        message: ''
      });
    }
  }, [formData.title, formData.chord, formData.id, setSongs, setSelectedSong]);

  // 드래그 앤 드롭 이벤트 핸들러들
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // 드래그가 완전히 영역을 벗어났을 때만 false로 설정
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // 파일 형식 검증
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setUploadStatus({
          isUploading: false,
          success: false,
          error: 'JPG, PNG, GIF 파일만 업로드할 수 있습니다.',
          message: ''
        });
        return;
      }

      // 찬양 이름과 코드가 모두 입력되지 않았으면 경고
      if (!formData.title.trim() || !formData.chord.trim()) {
        setUploadStatus({
          isUploading: false,
          success: false,
          error: '먼저 찬양 이름과 코드를 입력해주세요.',
          message: ''
        });
        return;
      }

      // 기존 handleFileUpload와 동일한 로직 사용
      handleFileUpload({ target: { files: [file] } });
    }
  }, [handleFileUpload, formData.title, formData.chord]);


  // 입력 필드 클릭 핸들러 - 간단한 버전
  const handleInputClick = useCallback((e) => {
    e.stopPropagation();
    
    const target = e.target;
    if (target) {
      target.focus();
    }
  }, []);

  // 입력 필드 포커스 핸들러 - 간단한 버전
  const handleInputFocus = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // 마우스 다운 핸들러 - 간단한 버전
  const handleInputMouseDown = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // 드롭다운 클릭 핸들러 - 드롭다운 전용
  const handleSelectClick = useCallback((e) => {
    e.stopPropagation();
    
    const target = e.target;
    if (target) {
      // 드롭다운 열기
      target.focus();
      
      // 드롭다운을 강제로 열기
      setTimeout(() => {
        target.click();
      }, 0);
    }
  }, []);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setDialog({
        isVisible: true,
        type: 'error',
        message: '찬양 이름을 입력해주세요.'
      });
      return;
    }

    // 항상 새로운 고유 ID 생성 (중복 허용)
    const newSong = {
      id: formData.id || Date.now() + Math.random(), // 고유 ID 보장
      ...formData,
      createdAt: new Date().toISOString()
    };

    setSongs(prev => [...prev, newSong]);
    setSelectedSong(newSong);
    
    // 폼 초기화
    setFormData({
      id: null,
      title: '',
      firstLyrics: '',
      chord: 'C',
      tempo: 'Medium',
      fileName: '',
      filePath: ''
    });
    
    setUploadStatus({
      isUploading: false,
      success: false,
      error: null,
      message: ''
    });

    setDialog({
      isVisible: true,
      type: 'success',
      message: '악보가 성공적으로 추가되었습니다!'
    });
  };

  return (
    <div className="add-song-page">
      <div className="page-header">
        <h1>
          <Plus className="header-icon" />
          악보 추가
        </h1>
        <p>새로운 찬양 악보를 추가하세요</p>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit} className="song-form">
          <div className="form-group compact-group full-width">
            <label className="form-label compact-label">
              <Music className="label-icon" />
              찬양 이름 *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              onClick={handleInputClick}
              onFocus={handleInputFocus}
              onMouseDown={handleInputMouseDown}
              className="form-input compact-input"
              placeholder="찬양 이름을 입력하세요"
              required
              autoComplete="off"
              tabIndex={1}
            />
          </div>

          <div className="form-row">
            <div className="form-group compact-group">
              <label className="form-label compact-label">코드</label>
              <select
                name="chord"
                value={formData.chord}
                onChange={handleInputChange}
                className="form-select compact-select"
                tabIndex={3}
              >
                <option value="">선택하세요</option>
                {keys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="form-group compact-group">
              <label className="form-label compact-label">빠르기</label>
              <select
                name="tempo"
                value={formData.tempo}
                onChange={handleInputChange}
                className="form-select compact-select"
                tabIndex={4}
              >
                <option value="">선택하세요</option>
                {tempos.map(tempo => (
                  <option key={tempo} value={tempo}>{tempo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group compact-group full-width">
            <label className="form-label compact-label">첫 가사</label>
            <input
              type="text"
              name="firstLyrics"
              value={formData.firstLyrics}
              onChange={handleInputChange}
              onClick={handleInputClick}
              onFocus={handleInputFocus}
              onMouseDown={handleInputMouseDown}
              className="form-input compact-input"
              placeholder="첫 번째 가사를 입력하세요"
              autoComplete="off"
              tabIndex={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group file-upload-group compact">
              <label className="form-label compact-label">
                <Upload className="label-icon" />
                악보 파일
              </label>
              <div 
                className={`file-upload-area compact ${isDragOver ? 'drag-over' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.gif"
                  className="file-input"
                  disabled={uploadStatus.isUploading}
                />
                <label htmlFor="file-upload" className={`file-upload-label compact ${uploadStatus.isUploading ? 'uploading' : ''} ${uploadStatus.success ? 'success' : ''}`}>
                  {uploadStatus.isUploading ? (
                    <>
                      <div className="upload-spinner"></div>
                      <span>처리 중...</span>
                    </>
                  ) : uploadStatus.success ? (
                    <>
                      <CheckCircle className="success-icon" />
                      <span>{formData.fileName}</span>
                    </>
                  ) : isDragOver ? (
                    <>
                      <Upload className="upload-icon" />
                      <span>파일을 놓으세요</span>
                    </>
                  ) : (
                    <>
                      <Upload className="upload-icon" />
                      <span>JPG, PNG, GIF 파일을 선택하거나 드래그하세요</span>
                    </>
                  )}
                </label>
              </div>
              
              {uploadStatus.success && (
                <div className="upload-success-message">
                  <span>파일이 성공적으로 처리되었습니다</span>
                </div>
              )}
              
              {uploadStatus.error && (
                <div className="upload-error-message">
                  <AlertCircle className="error-icon" />
                  <span>{uploadStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              <Plus className="btn-icon" />
              악보 추가
            </button>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => {
                setFormData({
                  title: '',
                  firstLyrics: '',
                  chord: 'C',
                  tempo: 'Medium',
                  fileName: '',
                  filePath: ''
                });
                setUploadStatus({
                  isUploading: false,
                  success: false,
                  error: null,
                  message: ''
                });
              }}
            >
              초기화
            </button>
          </div>
        </form>
      </div>
      
      <GhibliDialog
        isVisible={dialog.isVisible}
        type={dialog.type}
        message={dialog.message}
        onClose={() => setDialog({ isVisible: false, type: 'success', message: '' })}
      />
    </div>
  );
};

export default AddSong;
