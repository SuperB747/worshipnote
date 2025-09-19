import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Filter, Music, Hash, Clock, FileText, Edit3, Trash2, Plus, FileX, AlertTriangle, Upload, CheckCircle } from 'lucide-react';
import { processFileUpload } from '../utils/fileConverter';
import { saveSongs, saveWorshipLists, checkFileExists } from '../utils/storage';
import { isCorrectFileName, updateFileNameForSong } from '../utils/fileNameUtils';
import GhibliDialog from '../components/GhibliDialog';
import './SearchSongs.css';

const SearchSongs = ({ songs, setSongs, selectedSong, setSelectedSong, fileExistenceMap, setFileExistenceMap, worshipLists, setWorshipLists, isFileExistenceLoaded }) => {
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    key: '',
    tempo: ''
  });
  const [activeFilter, setActiveFilter] = useState(null); // 'missing' 또는 'filename-error' 또는 null
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
  const [dialog, setDialog] = useState({ isVisible: false, type: 'success', message: '' });
  const [confirmDialog, setConfirmDialog] = useState({ isVisible: false, message: '', onConfirm: null });

  const keys = ['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Em', 'Eb', 'F', 'G'];
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

  // 파일명이 올바른 형식인지 확인하는 함수
  const hasCorrectFileName = (song) => {
    if (!song.fileName || song.fileName.trim() === '') {
      return false;
    }
    return isCorrectFileName(song.fileName);
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
      
      // 액티브 필터 적용
      let matchesActiveFilter = true;
      if (activeFilter === 'missing') {
        matchesActiveFilter = !hasMusicSheet(song);
      } else if (activeFilter === 'filename-error') {
        matchesActiveFilter = hasMusicSheet(song) && !hasCorrectFileName(song);
      }
      
      
      return matchesSearch && matchesKey && matchesTempo && matchesActiveFilter;
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
  }, [songs, searchTerm, filters, activeFilter, fileExistenceMap]);

  // 악보 누락 개수 계산
  // 파일명 에러 개수 계산
  const filenameErrorCount = useMemo(() => {
    return songs.filter(song => hasMusicSheet(song) && !hasCorrectFileName(song)).length;
  }, [songs, fileExistenceMap]);

  const missingMusicSheetCount = useMemo(() => {
    return songs.filter(song => !hasMusicSheet(song)).length;
  }, [songs, fileExistenceMap]);

  // 토글 핸들러 함수
  const handleFilterToggle = (filterType) => {
    if (activeFilter === filterType) {
      // 같은 필터를 클릭하면 토글 해제
      setActiveFilter(null);
    } else {
      // 다른 필터를 클릭하면 해당 필터로 변경
      setActiveFilter(filterType);
    }
  };

  // 필터가 변경될 때마다 액티브 필터 해제 (해당 항목이 없을 때)
  useEffect(() => {
    if (activeFilter === 'missing' && missingMusicSheetCount === 0) {
      setActiveFilter(null);
    }
    if (activeFilter === 'filename-error' && filenameErrorCount === 0) {
      setActiveFilter(null);
    }
  }, [activeFilter, missingMusicSheetCount, filenameErrorCount]);

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
    setConfirmDialog({
      isVisible: true,
      message: '정말로 이 찬양을 삭제하시겠습니까?',
      onConfirm: async () => {
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
        const updatedSongs = songs.filter(song => song.id !== songId);
        setSongs(updatedSongs);
        
        // 데이터베이스에 저장
        try {
          const success = await saveSongs(updatedSongs);
          if (success) {
            showSnackbar('찬양이 삭제되었습니다.', 'success');
          } else {
            showSnackbar('찬양 삭제에 실패했습니다.', 'error');
          }
        } catch (error) {
          console.error('찬양 삭제 실패:', error);
          showSnackbar('찬양 삭제 중 오류가 발생했습니다.', 'error');
        }
        
        // 삭제된 곡이 현재 선택된 곡이면 선택 해제
        if (setSelectedSong) {
          setSelectedSong(null);
        }

        setConfirmDialog({ isVisible: false, message: '', onConfirm: null });
      }
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 수정 모달 입력 필드 클릭 핸들러 - 간단한 버전
  const handleEditInputClick = (e) => {
    e.stopPropagation();
    
    const target = e.target;
    if (target) {
      target.focus();
    }
  };

  // 수정 모달 입력 필드 포커스 핸들러 - 간단한 버전
  const handleEditInputFocus = (e) => {
    e.stopPropagation();
  };

  // 수정 모달 마우스 다운 핸들러 - 간단한 버전
  const handleEditInputMouseDown = (e) => {
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
      const result = await processFileUpload(
        file, 
        editingSong?.id, 
        editFormData.title, 
        editFormData.key
      );
      
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
      setDialog({
        isVisible: true,
        type: 'error',
        message: '찬양 이름을 입력해주세요.'
      });
      return;
    }

    const updatedSong = {
      ...editingSong,
      ...editFormData,
      updatedAt: new Date().toISOString()
    };

    // 파일명 업데이트 (찬양 이름이나 코드가 변경된 경우)
    let finalUpdatedSong = updatedSong;
    console.log('=== SearchSongs 파일명 업데이트 시작 ===');
    console.log('editingSong.fileName:', editingSong.fileName);
    console.log('editingSong.title:', editingSong.title, '-> updatedSong.title:', updatedSong.title);
    console.log('editingSong.key:', editingSong.key, '-> updatedSong.key:', updatedSong.key);
    
    if (editingSong.fileName && editingSong.fileName.trim() !== '') {
      try {
        console.log('파일명 업데이트 함수 호출...');
        const fileNameUpdateResult = await updateFileNameForSong(editingSong, updatedSong);
        console.log('파일명 업데이트 결과:', fileNameUpdateResult);
        
        if (fileNameUpdateResult.success && fileNameUpdateResult.newFileName) {
          finalUpdatedSong = {
            ...updatedSong,
            fileName: fileNameUpdateResult.newFileName
          };
          console.log('파일명 업데이트 완료:', fileNameUpdateResult.message);
          console.log('최종 업데이트된 찬양:', finalUpdatedSong);
        } else if (!fileNameUpdateResult.success) {
          console.warn('파일명 업데이트 실패:', fileNameUpdateResult.error);
        }
      } catch (error) {
        console.error('파일명 업데이트 중 오류:', error);
      }
    } else {
      console.log('기존 파일명이 없어서 파일명 업데이트를 스킵합니다.');
    }

    // 상태 업데이트
    const updatedSongs = songs.map(song => 
      song.id === editingSong.id ? finalUpdatedSong : song
    );
    
    // 모든 찬양 리스트에서 해당 곡 업데이트 (ID로 매칭)
    const updatedWorshipLists = {};
    Object.keys(worshipLists).forEach(dateKey => {
      updatedWorshipLists[dateKey] = worshipLists[dateKey].map(song => 
        song.id === editingSong.id ? finalUpdatedSong : song
      );
    });
    
    setSongs(updatedSongs);
    setWorshipLists(updatedWorshipLists);
    
    // 파일 존재 여부 확인 및 fileExistenceMap 업데이트
    if (updatedSong.fileName && updatedSong.fileName.trim() !== '') {
      try {
        const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
        const fullPath = `${musicSheetsPath}/${updatedSong.fileName}`;
        const exists = await checkFileExists(fullPath);
        
        setFileExistenceMap(prev => ({
          ...prev,
          [updatedSong.id]: exists
        }));
      } catch (error) {
        console.error('파일 존재 여부 확인 실패:', error);
        setFileExistenceMap(prev => ({
          ...prev,
          [updatedSong.id]: false
        }));
      }
    } else {
      setFileExistenceMap(prev => ({
        ...prev,
        [updatedSong.id]: false
      }));
    }
    
    // OneDrive와 localStorage에 저장
    try {
      const saveResult = await saveSongs(updatedSongs);
      if (!saveResult) {
        console.error('찬양 저장 실패');
        setDialog({
          isVisible: true,
          type: 'error',
          message: '찬양 저장에 실패했습니다. 다시 시도해주세요.'
        });
        return;
      }
      
      // 찬양 리스트도 저장
      await saveWorshipLists(updatedWorshipLists);
    } catch (error) {
      console.error('찬양 저장 중 오류:', error);
      setDialog({
        isVisible: true,
        type: 'error',
        message: '찬양 저장 중 오류가 발생했습니다. 다시 시도해주세요.'
      });
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
      if (editFormData.fileName && window.electronAPI && window.electronAPI.deleteFile) {
        // Music_Sheets 경로를 가져와서 전체 경로 구성
        const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
        const fullPath = `${musicSheetsPath}/${editFormData.fileName}`;
        
        const result = await window.electronAPI.deleteFile(fullPath);
        
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
      
      // fileExistenceMap 업데이트
      setFileExistenceMap(prev => ({
        ...prev,
        [editingSong.id]: false
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
      
      // fileExistenceMap 업데이트
      setFileExistenceMap(prev => ({
        ...prev,
        [editingSong.id]: false
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
          <div className="header-left">
            <h3>
              찬양 악보 리스트 ({filteredSongs.length}개)
            </h3>
          </div>
          {isFileExistenceLoaded && (missingMusicSheetCount > 0 || filenameErrorCount > 0) && (
            <div className="header-right">
              {missingMusicSheetCount > 0 && (
                <button 
                  className={`filter-button ${activeFilter === 'missing' ? 'active' : ''}`}
                  onClick={() => handleFilterToggle('missing')}
                >
                  악보 누락 ({missingMusicSheetCount}개)
                </button>
              )}
              {filenameErrorCount > 0 && (
                <button 
                  className={`filter-button ${activeFilter === 'filename-error' ? 'active' : ''}`}
                  onClick={() => handleFilterToggle('filename-error')}
                >
                  파일이름 에러 ({filenameErrorCount}개)
                </button>
              )}
            </div>
          )}
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
                </div>
                
                {/* 오른쪽 아이콘들을 위한 고정 컨테이너 */}
                <div className="song-actions">
                  {/* 악보 상태 아이콘과 메타 정보 */}
                  <div className="song-meta">
                    <div className="music-sheet-status">
                      {isFileExistenceLoaded ? (
                        hasMusicSheet(song) ? (
                          hasCorrectFileName(song) ? (
                            <div className="status-correct-filename" title="악보 파일 정상">
                              <FileText className="status-icon correct-icon" />
                            </div>
                          ) : (
                            <div className="status-incorrect-filename" title="파일명 형식이 올바르지 않음">
                              <AlertTriangle className="status-icon warning-icon" />
                            </div>
                          )
                        ) : (
                          <div className="status-no-file" title="악보 파일 없음">
                            <FileX className="status-icon no-file-icon" />
                          </div>
                        )
                      ) : null}
                    </div>
                    <span className="song-key">{song.key}</span>
                    <span className="song-tempo">{song.tempo}</span>
                  </div>
                  
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(song);
                    }}
                    title="수정"
                  >
                    <Edit3 className="action-icon" size={14} />
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(song.id);
                    }}
                    title="삭제"
                  >
                    <Trash2 className="action-icon" size={14} />
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
            
            <form onSubmit={handleEditSubmit} className="edit-form compact-form">
              <div className="form-group compact-group full-width">
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

              <div className="form-row">
                <div className="form-group compact-group">
                  <label className="form-label compact-label">코드</label>
                  <select
                    name="key"
                    value={editFormData.key}
                    onChange={handleEditInputChange}
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
                    value={editFormData.tempo}
                    onChange={handleEditInputChange}
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
                  value={editFormData.firstLyrics}
                  onChange={handleEditInputChange}
                  onClick={handleEditInputClick}
                  onFocus={handleEditInputFocus}
                  onMouseDown={handleEditInputMouseDown}
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
                    {editFormData.fileName && (
                      <span className="current-file-name">: {editFormData.fileName}</span>
                    )}
                    {editFormData.fileName && (
                      <button 
                        type="button"
                        className="delete-file-btn-inline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteConfirm(true);
                        }}
                        title="파일 삭제"
                      >
                        <Trash2 className="delete-icon" />
                      </button>
                    )}
                  </label>
                  <div className="file-upload-area compact">
                    <input
                      type="file"
                      id="edit-file-upload"
                      onChange={handleEditFileUpload}
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="file-input"
                      disabled={uploadStatus.isUploading}
                    />
                    <label 
                      htmlFor="edit-file-upload" 
                      className={`file-upload-label compact ${uploadStatus.isUploading ? 'uploading' : ''} ${uploadStatus.success ? 'success' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadStatus.isUploading ? (
                        <>
                          <div className="upload-spinner"></div>
                          <span>처리 중...</span>
                        </>
                      ) : uploadStatus.success ? (
                        <>
                          <CheckCircle className="success-icon" />
                          <span>{editFormData.fileName}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="upload-icon" />
                          <span>JPG, PNG, PDF 파일을 선택하세요</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  <Edit3 className="btn-icon" />
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
      
      <GhibliDialog
        isVisible={dialog.isVisible}
        type={dialog.type}
        message={dialog.message}
        onClose={() => setDialog({ isVisible: false, type: 'success', message: '' })}
      />
      
      <GhibliDialog
        isVisible={confirmDialog.isVisible}
        type="info"
        title="확인"
        message={confirmDialog.message}
        onClose={() => setConfirmDialog({ isVisible: false, message: '', onConfirm: null })}
        showCloseButton={false}
      >
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button 
            className="ghibli-dialog-button"
            onClick={() => setConfirmDialog({ isVisible: false, message: '', onConfirm: null })}
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #a68b5b 100%)' }}
          >
            취소
          </button>
          <button 
            className="ghibli-dialog-button"
            onClick={() => {
              if (confirmDialog.onConfirm) {
                confirmDialog.onConfirm();
              }
            }}
          >
            확인
          </button>
        </div>
      </GhibliDialog>
    </div>
  );
};

export default SearchSongs;
