import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Filter, Music, Hash, Clock, FileText, Edit, Trash2, Plus, FileX } from 'lucide-react';
import { processFileUpload } from '../utils/fileConverter';
import { saveSongs } from '../utils/storage';
import './SearchSongs.css';

const SearchSongs = ({ songs, setSongs, selectedSong, setSelectedSong, fileExistenceMap }) => {
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    key: '',
    tempo: ''
  });
  const [editingSong, setEditingSong] = useState(null);
  const [editFormData, setEditFormData] = useState({
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [originalSelectedSong, setOriginalSelectedSong] = useState(null);

  const keys = ['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Eb', 'F', 'G'];
  const tempos = ['Fast', 'Medium', 'Slow'];

  // 악보 파일이 있는지 확인하는 함수 (실제 파일 존재 여부 포함)
  const hasMusicSheet = (song) => {
    // fileName이 없으면 악보 없음
    if (!song.fileName || song.fileName.trim() === '') {
      return false;
    }
    
    // 파일 존재 여부 상태에서 확인
    return fileExistenceMap[song.id] === true;
  };

  // 컴포넌트 마운트 시 검색 입력 필드 포커스
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);


  const filteredSongs = useMemo(() => {
    const filtered = songs.filter(song => {
      const matchesSearch = 
        !searchTerm.trim() || // 검색어가 비어있으면 모든 곡 표시
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.firstLyrics.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesKey = !filters.key || song.key === filters.key;
      const matchesTempo = !filters.tempo || song.tempo === filters.tempo;
      
      return matchesSearch && matchesKey && matchesTempo;
    });
    
    // 정렬: 한글과 영어를 모두 고려한 알파벳/가나다 순서
    const sorted = filtered.sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      
      // 한글과 영어를 구분하여 정렬
      const isKoreanA = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(titleA);
      const isKoreanB = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(titleB);
      
      if (isKoreanA && !isKoreanB) {
        return -1; // 한글이 영어보다 앞에
      } else if (!isKoreanA && isKoreanB) {
        return 1; // 영어가 한글보다 뒤에
      } else {
        // 같은 언어군 내에서는 일반적인 정렬
        return titleA.localeCompare(titleB, 'ko', { numeric: true });
      }
    });
    
    return sorted;
  }, [songs, searchTerm, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ key: '', tempo: '' });
  };

  const handleEdit = (song) => {
    // 수정 모달을 열 때 현재 선택된 곡을 저장
    setOriginalSelectedSong(selectedSong);
    setEditingSong(song);
    setEditFormData({
      title: song.title,
      firstLyrics: song.firstLyrics || '',
      key: song.key,
      tempo: song.tempo,
      fileName: song.fileName || '',
      filePath: song.filePath || ''
    });
    setUploadStatus({
      isUploading: false,
      success: false,
      error: null,
      message: ''
    });
  };

  const handleDelete = async (songId) => {
    if (window.confirm('정말로 이 찬양을 삭제하시겠습니까?')) {
      // 삭제할 곡 찾기
      const songToDelete = songs.find(song => song.id === songId);
      
      // OneDrive에서 파일 삭제
      if (songToDelete && songToDelete.filePath && window.electronAPI && window.electronAPI.deleteFile) {
        try {
          const result = await window.electronAPI.deleteFile(songToDelete.filePath);
          if (!result.success) {
            console.error('OneDrive 파일 삭제 실패:', result.error);
          }
        } catch (error) {
          console.error('파일 삭제 중 오류:', error);
        }
      }
      
      // UI에서 곡 제거
      setSongs(prev => prev.filter(song => song.id !== songId));
      
      // 삭제된 곡이 현재 선택된 곡이면 선택 해제
      if (setSelectedSong) {
        setSelectedSong(null);
      }
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 수정 모달 입력 필드 클릭 핸들러 - 더 안정적인 버전
  const handleEditInputClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (target && target.focus) {
      target.focus();
    }
  };

  // 수정 모달 입력 필드 포커스 핸들러 - 더 안정적인 버전
  const handleEditInputFocus = (e) => {
    const target = e.target;
    if (target && target.select) {
      target.select();
    }
  };

  // 수정 모달 마우스 다운 핸들러
  const handleEditInputMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEditFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
        setEditFormData(prev => ({
          ...prev,
          fileName: result.fileName,
          filePath: result.filePath
        }));
        
        setUploadStatus({
          isUploading: false,
          success: true,
          error: null,
          message: result.message
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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.title.trim()) {
      alert('찬양 이름을 입력해주세요.');
      return;
    }

    const updatedSong = {
      ...editingSong,
      ...editFormData,
      updatedAt: new Date().toISOString()
    };

    // 상태 업데이트
    const updatedSongs = songs.map(song => 
      song.id === editingSong.id ? updatedSong : song
    );
    
    setSongs(updatedSongs);
    
    // OneDrive와 localStorage에 저장
    try {
      const saveResult = await saveSongs(updatedSongs);
      if (!saveResult) {
        console.error('찬양 저장 실패');
        alert('찬양 저장에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    } catch (error) {
      console.error('찬양 저장 중 오류:', error);
      alert('찬양 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
    }
    
    // 수정된 곡이 현재 선택된 곡이면 업데이트, 아니면 원래 선택된 곡 유지
    if (selectedSong && selectedSong.id === editingSong.id) {
      setSelectedSong(updatedSong);
    } else if (originalSelectedSong) {
      setSelectedSong(originalSelectedSong);
    }
    
    setEditingSong(null);
    setOriginalSelectedSong(null);
    alert('찬양이 성공적으로 수정되었습니다!');
  };

  const handleEditCancel = () => {
    setEditingSong(null);
    setOriginalSelectedSong(null);
    setEditFormData({
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
    setShowDeleteConfirm(false);
  };

  const handleDeleteFile = async () => {
    try {
      // OneDrive에서 실제 파일 삭제
      if (editFormData.filePath && window.electronAPI && window.electronAPI.deleteFile) {
        const result = await window.electronAPI.deleteFile(editFormData.filePath);
        if (!result.success) {
          console.error('OneDrive 파일 삭제 실패:', result.error);
          // 파일 삭제 실패해도 UI에서는 제거 (사용자에게 알림)
        }
      }
      
      // UI에서 파일 정보 제거
      setEditFormData(prev => ({
        ...prev,
        fileName: '',
        filePath: ''
      }));
      setShowDeleteConfirm(false);
      setUploadStatus({
        isUploading: false,
        success: true,
        error: null,
        message: '악보 파일이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('파일 삭제 중 오류:', error);
      // 오류가 발생해도 UI에서는 제거
      setEditFormData(prev => ({
        ...prev,
        fileName: '',
        filePath: ''
      }));
      setShowDeleteConfirm(false);
      setUploadStatus({
        isUploading: false,
        success: true,
        error: null,
        message: '악보 파일이 삭제되었습니다.'
      });
    }
  };

  return (
    <div 
      className="search-songs-page"
      onClick={(e) => {
        // 수정 모달이 열려있지 않고, 리스트 아이템이나 버튼이 아닌 곳을 클릭하면 선택 해제
        if (!editingSong && !e.target.closest('.song-list-item') && !e.target.closest('button')) {
          setSelectedSong(null);
        }
      }}
    >
      <div className="page-header">
        <h1>
          <Search className="header-icon" />
          악보 검색
        </h1>
        <p>찬양을 검색하고 필터링하세요</p>
      </div>

      <div className="search-container">
        <div className="search-bar">
          <div className="search-input-group">
            <Search className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="찬양 이름이나 가사로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="filters-container">
          <div className="filters-header">
            <Filter className="filter-icon" />
            <span>필터</span>
            <button 
              className="clear-filters-btn"
              onClick={clearFilters}
            >
              초기화
            </button>
          </div>
          
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">코드</label>
              <select
                value={filters.key}
                onChange={(e) => handleFilterChange('key', e.target.value)}
                className="filter-select"
              >
                <option value="">모든 코드</option>
                {keys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">빠르기</label>
              <select
                value={filters.tempo}
                onChange={(e) => handleFilterChange('tempo', e.target.value)}
                className="filter-select"
              >
                <option value="">모든 빠르기</option>
                {tempos.map(tempo => (
                  <option key={tempo} value={tempo}>{tempo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="results-container">
        <div className="results-header">
          <h3>
            찬양 악보 리스트 ({filteredSongs.length}개)
          </h3>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="no-results">
            <Music className="no-results-icon" />
            <h4>검색 결과가 없습니다</h4>
            <p>다른 검색어나 필터를 시도해보세요</p>
          </div>
        ) : (
          <div className="songs-list">
            {filteredSongs.map(song => (
              <div 
                key={song.id} 
                className={`song-list-item ${selectedSong && selectedSong.id === song.id ? 'selected' : ''}`}
              >
                <div 
                  className="song-content"
                  onClick={() => {
                    // 곡을 클릭하면 선택 (재클릭해도 선택 유지)
                    setSelectedSong(song);
                  }}
                >
                  <div className="song-info">
                    <h4>{song.title}</h4>
                  </div>
                  <div className="song-meta">
                    {/* 악보 상태 아이콘 */}
                    <div className="music-sheet-status">
                      {hasMusicSheet(song) ? (
                        <div className="status-with-file" title="악보 파일 있음">
                          <FileText className="status-icon file-icon" />
                        </div>
                      ) : (
                        <div className="status-no-file" title="악보 파일 없음">
                          <FileX className="status-icon no-file-icon" />
                        </div>
                      )}
                    </div>
                    <span className="song-key">{song.key}</span>
                    <span className="song-tempo">{song.tempo}</span>
                  </div>
                </div>
                
                <div className="song-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(song);
                    }}
                    title="수정"
                  >
                    <Edit className="action-icon" />
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(song.id);
                    }}
                    title="삭제"
                  >
                    <Trash2 className="action-icon" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editingSong && (
        <div 
          className="edit-modal-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="edit-modal-header">
              <h3>찬양 수정</h3>
              <button className="close-btn" onClick={handleEditCancel}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="edit-form">
              <div className="form-row compact-row">
                <div className="form-group compact-group">
                  <label className="form-label compact-label">
                    <Music className="label-icon" />
                    찬양 이름 *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={editFormData.title}
                    onChange={handleEditInputChange}
                    onClick={handleEditInputClick}
                    onFocus={handleEditInputFocus}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-input compact-input"
                    placeholder="찬양 이름을 입력하세요"
                    required
                    autoComplete="off"
                    tabIndex={1}
                  />
                </div>

                <div className="form-group compact-group">
                  <label className="form-label compact-label">코드</label>
                  <select
                    name="key"
                    value={editFormData.key}
                    onChange={handleEditInputChange}
                    onClick={handleEditInputClick}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-select compact-select"
                    tabIndex={2}
                  >
                    {keys.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group compact-group">
                  <label className="form-label compact-label">빠르기</label>
                  <select
                    name="tempo"
                    value={editFormData.tempo}
                    onChange={handleEditInputChange}
                    onClick={handleEditInputClick}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-select compact-select"
                    tabIndex={3}
                  >
                    {tempos.map(tempo => (
                      <option key={tempo} value={tempo}>{tempo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row compact-row">
                <div className="form-group compact-group full-width">
                  <label className="form-label compact-label">첫 가사</label>
                  <input
                    type="text"
                    name="firstLyrics"
                    value={editFormData.firstLyrics}
                    onChange={handleEditInputChange}
                    onClick={handleEditInputClick}
                    onFocus={handleEditInputFocus}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-input compact-input"
                    placeholder="첫 번째 가사를 입력하세요"
                    autoComplete="off"
                    tabIndex={4}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group file-upload-group">
                  <label className="form-label">
                    <FileText className="label-icon" />
                    악보 파일 (JPG, PNG, PDF)
                  </label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="edit-file-upload"
                      onChange={handleEditFileUpload}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="file-input"
                      disabled={uploadStatus.isUploading}
                    />
                    <label 
                      htmlFor="edit-file-upload" 
                      className={`file-upload-label ${uploadStatus.isUploading ? 'uploading' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadStatus.isUploading ? (
                        <>
                          <div className="upload-spinner"></div>
                          <span>처리 중...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="upload-icon" />
                          <span>새 악보 파일 선택 (선택사항)</span>
                        </>
                      )}
                    </label>
                    
                    {editFormData.fileName && (
                      <div className="current-file">
                        <div className="file-info">
                          <span>현재 파일: {editFormData.fileName}</span>
                          <button 
                            type="button"
                            className="delete-file-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowDeleteConfirm(true);
                            }}
                            title="파일 삭제"
                          >
                            <Trash2 className="delete-icon" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {uploadStatus.success && (
                      <div className="upload-success">
                        <span>파일이 성공적으로 업데이트되었습니다!</span>
                      </div>
                    )}
                    
                    {uploadStatus.error && (
                      <div className="upload-error">
                        <span>{uploadStatus.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  <Edit className="btn-icon" />
                  수정 완료
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={handleEditCancel}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 파일 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <div className="delete-confirm-header">
              <h3>파일 삭제 확인</h3>
            </div>
            <div className="delete-confirm-content">
              <p>정말로 이 악보 파일을 삭제하시겠습니까?</p>
              <p className="file-name">파일: {editFormData.fileName}</p>
            </div>
            <div className="delete-confirm-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </button>
              <button 
                className="btn-danger"
                onClick={handleDeleteFile}
              >
                <Trash2 className="btn-icon" />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSongs;
