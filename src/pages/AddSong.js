import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Upload, Music, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { processFileUpload } from '../utils/fileConverter';
import './AddSong.css';

const AddSong = ({ songs, setSongs, setSelectedSong }) => {
  const titleInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    firstLyrics: '',
    key: 'C',
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

  const keys = ['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Eb', 'F', 'G'];
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

  // 입력 필드 클릭 핸들러 - 강화된 버전
  const handleInputClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    const target = e.target;
    if (target) {
      // 강제로 포커스 설정
      target.focus();
      target.click();
      
      // 커서 위치 설정
      if (target.setSelectionRange && target.value) {
        const len = target.value.length;
        target.setSelectionRange(len, len);
      }
    }
  }, []);

  // 입력 필드 포커스 핸들러 - 강화된 버전
  const handleInputFocus = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (target) {
      // 텍스트 선택
      if (target.select) {
        target.select();
      }
      
      // 커서를 끝으로 이동
      if (target.setSelectionRange && target.value) {
        const len = target.value.length;
        target.setSelectionRange(len, len);
      }
    }
  }, []);

  // 마우스 다운 핸들러 - 강화된 버전
  const handleInputMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    const target = e.target;
    if (target) {
      // 즉시 포커스 설정
      target.focus();
    }
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadStatus({
        isUploading: false,
        success: false,
        error: 'JPG, PNG, PDF 파일만 업로드할 수 있습니다.',
        message: ''
      });
      return;
    }

    setUploadStatus({
      isUploading: true,
      success: false,
      error: null,
      message: '파일을 처리하는 중...'
    });

    try {
      const result = await processFileUpload(file);
      
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('찬양 이름을 입력해주세요.');
      return;
    }

    const newSong = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString()
    };

    setSongs(prev => [...prev, newSong]);
    setSelectedSong(newSong);
    
    // 폼 초기화
    setFormData({
      title: '',
      firstLyrics: '',
      key: 'C',
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

    alert('악보가 성공적으로 추가되었습니다!');
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
          <div className="form-row compact-row">
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
                  name="key"
                  value={formData.key}
                  onChange={handleInputChange}
                  onClick={handleInputClick}
                  onMouseDown={handleInputMouseDown}
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
                  onClick={handleInputClick}
                  onMouseDown={handleInputMouseDown}
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
          </div>

          <div className="form-row compact-row">
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
          </div>

          <div className="form-row">
            <div className="form-group file-upload-group compact">
              <label className="form-label compact-label">
                <Upload className="label-icon" />
                악보 파일
              </label>
              <div className="file-upload-area compact">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.pdf"
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
                  ) : (
                    <>
                      <Upload className="upload-icon" />
                      <span>JPG, PNG, PDF 파일을 선택하세요</span>
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
                  key: 'C',
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

    </div>
  );
};

export default AddSong;
