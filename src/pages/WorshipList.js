import React, { useState, useMemo } from 'react';
import { useSnackbar } from '../hooks/useSnackbar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Plus, Music, Search, X, GripVertical, ChevronLeft, ChevronRight, Edit3, Download, FileText, Upload, AlertTriangle } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { saveWorshipLists, saveSongs } from '../utils/storage';
import { generateWorshipListPDF } from '../utils/pdfExporter';
import { processFileUpload } from '../utils/fileConverter';
import { isCorrectFileName } from '../utils/fileNameUtils';
import GhibliDialog from '../components/GhibliDialog';
import './WorshipList.css';

// SortableItem 컴포넌트
const SortableItem = ({ song, index, onRemove, onSelect, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`list-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <GripVertical className="grip-icon" />
      </div>
      
      <div 
        className="song-content"
        onClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect(song);
        }}
      >
        <div className="song-number">{index + 1}</div>
        <div className="song-details">
          <h5 className="song-title">{song.title}</h5>
          {/* 악보 상태 아이콘 */}
          <div className="music-sheet-status">
            {song.fileName ? (
              isCorrectFileName(song) ? null : (
                <div className="status-incorrect-filename" title="파일명 형식이 올바르지 않음">
                  <AlertTriangle className="status-icon warning-icon" />
                </div>
              )
            ) : (
              <div className="status-no-file" title="악보 파일 없음">
                <FileText className="status-icon no-file-icon" />
              </div>
            )}
          </div>
        </div>
        <button 
          className="edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit && onEdit(song);
          }}
          title="찬양 정보 수정"
        >
          <Edit3 className="edit-icon" />
        </button>
      </div>
      
      <button 
        className="remove-btn"
        onClick={() => onRemove(song.id)}
      >
        <X />
      </button>
    </div>
  );
};

const WorshipList = ({ songs, worshipLists, setWorshipLists, setSelectedSong, setSongs }) => {
  const { showSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [previewSong, setPreviewSong] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [selectionOrder, setSelectionOrder] = useState([]);
  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({ 
    title: '', 
    key: '', 
    tempo: '', 
    firstLyrics: '', 
    fileName: '', 
    filePath: '' 
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    success: false,
    error: null,
    message: ''
  });
  const [dialog, setDialog] = useState({ isVisible: false, type: 'success', message: '' });

  // 찬양 리스트의 모든 곡들을 원본 데이터베이스의 최신 정보로 업데이트
  const refreshWorshipListSongs = () => {
    // 업데이트 중일 때는 새로고침하지 않음
    if (isUpdating) return;
    
    setWorshipLists(prev => {
      const updatedLists = {};
      let hasChanges = false;

      Object.keys(prev).forEach(dateKey => {
        updatedLists[dateKey] = prev[dateKey].map(song => {
          const latestSong = songs.find(s => s.id === song.id);
          if (latestSong && latestSong.title !== song.title) {
            console.log(`찬양 리스트 곡 업데이트: ${song.title} -> ${latestSong.title}`);
            hasChanges = true;
            return latestSong;
          }
          return song;
        });
      });

      if (hasChanges) {
        showSnackbar('찬양 리스트가 최신 정보로 업데이트되었습니다.', 'success');
      }
      return hasChanges ? updatedLists : prev;
    });
  };

  // 컴포넌트 마운트 시 찬양 리스트 새로고침
  React.useEffect(() => {
    if (songs.length > 0 && Object.keys(worshipLists).length > 0) {
      refreshWorshipListSongs();
    }
  }, [songs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredSongs = useMemo(() => {
    let filtered = songs;
    
    if (searchTerm) {
      filtered = songs.filter(song => 
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.firstLyrics.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
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
  }, [songs, searchTerm]);

  // 시차 문제를 방지하기 위해 로컬 날짜를 직접 사용
  const currentDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const currentWorshipList = worshipLists[currentDateKey] || [];

  // 파일명 에러 개수 계산
  const filenameErrorCount = useMemo(() => {
    return currentWorshipList.filter(song => song.fileName && !isCorrectFileName(song)).length;
  }, [currentWorshipList]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    
    // 해당 월의 첫 주 일요일부터 마지막 주 토요일까지
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일부터 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // 토요일까지
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [selectedDate]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowSongSearch(false);
  };

  const handlePrevMonth = () => {
    setSelectedDate(prev => subDays(startOfMonth(prev), 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => addDays(endOfMonth(prev), 1));
  };

  const handleSongClick = (song) => {
    setPreviewSong(song);
    setSelectedSong(song);
  };

  // 곡 선택 핸들러
  const handleSongSelect = (song, event) => {
    event.stopPropagation();
    
    setSelectedSongs(prev => {
      const isSelected = prev.some(s => s.id === song.id);
      if (isSelected) {
        // 이미 선택된 곡이면 선택 해제
        return prev.filter(s => s.id !== song.id);
      } else {
        // 선택되지 않은 곡이면 선택 목록에 추가
        return [...prev, song];
      }
    });

    setSelectionOrder(prev => {
      const isSelected = prev.some(s => s.id === song.id);
      if (isSelected) {
        // 이미 선택된 곡이면 순서에서 제거
        return prev.filter(s => s.id !== song.id);
      } else {
        // 선택되지 않은 곡이면 순서 목록에 추가 (체크 순서대로)
        return [...prev, song];
      }
    });
  };

  // 선택된 곡들을 리스트에 추가 (체크 순서대로)
  const handleAddSelectedSongs = () => {
    if (selectedSongs.length === 0) return;

    // 체크 순서대로 필터링하여 중복 제거하고, 원본 데이터베이스에서 최신 정보 가져오기
    const newSongs = selectionOrder
      .filter(song => !currentWorshipList.some(existingSong => existingSong.id === song.id))
      .map(song => {
        // 원본 데이터베이스에서 최신 정보를 가져와서 사용
        return songs.find(latestSong => latestSong.id === song.id) || song;
      });

    if (newSongs.length > 0) {
      const newList = [...currentWorshipList, ...newSongs];
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      
      // 선택 초기화
      setSelectedSongs([]);
      setSelectionOrder([]);
      setShowSongSearch(false);
      setPreviewSong(null);
    }
  };

  // 검색 모달 닫을 때 선택 초기화
  const handleCloseSearchModal = () => {
    setShowSongSearch(false);
    setPreviewSong(null);
    setSelectedSongs([]);
    setSelectionOrder([]);
  };

  const handleOpenSongSearch = () => {
    setSearchTerm(''); // 검색어 리셋
    setShowSongSearch(true);
    setPreviewSong(null);
    setSelectedSongs([]);
    
    // 검색 입력 필드에 포커스 (모달이 열린 후)
    setTimeout(() => {
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  };

  const handleAddSong = () => {
    if (previewSong) {
      // 원본 데이터베이스에서 최신 정보를 가져와서 사용
      const latestSong = songs.find(song => song.id === previewSong.id) || previewSong;
      
      console.log('=== 찬양 리스트에 곡 추가 ===');
      console.log('미리보기 곡:', previewSong);
      console.log('원본 데이터베이스에서 찾은 최신 곡:', latestSong);
      console.log('제목이 다른가?', previewSong.title !== latestSong.title);
      
      const newList = [...currentWorshipList, latestSong];
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      setShowSongSearch(false);
      setSearchTerm('');
      setPreviewSong(null);
    }
  };

  const handleRemoveSong = (songId) => {
    const newList = currentWorshipList.filter(song => song.id !== songId);
    setWorshipLists(prev => ({
      ...prev,
      [currentDateKey]: newList
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = currentWorshipList.findIndex(song => song.id === active.id);
      const newIndex = currentWorshipList.findIndex(song => song.id === over.id);
      
      const newList = arrayMove(currentWorshipList, oldIndex, newIndex);
      
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
    }
  };

  const handleEditSong = (song) => {
    setEditingSong(song);
    setEditForm({
      title: song.title,
      key: song.key || song.code || '', // code 필드도 확인
      tempo: song.tempo || '',
      firstLyrics: song.firstLyrics || '',
      fileName: song.fileName || '',
      filePath: song.filePath || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSong || !editForm.title.trim()) return;

    const updatedSong = {
      ...editingSong,
      title: editForm.title.trim(),
      key: editForm.key.trim(),
      code: editForm.key.trim(), // code 필드도 업데이트
      tempo: editForm.tempo.trim(),
      firstLyrics: editForm.firstLyrics.trim(),
      fileName: editForm.fileName,
      filePath: editForm.filePath,
      updatedAt: new Date().toISOString()
    };

    try {
      setIsUpdating(true); // 업데이트 시작
      
      // 원본 데이터베이스에서 해당 곡 찾아서 업데이트
      const updatedSongs = songs.map(song => 
        song.id === editingSong.id ? updatedSong : song
      );
      
      // 모든 찬양 리스트에서 해당 곡 업데이트 (ID로 매칭)
      const updatedWorshipLists = {};
      Object.keys(worshipLists).forEach(dateKey => {
        updatedWorshipLists[dateKey] = worshipLists[dateKey].map(song => 
          song.id === editingSong.id ? updatedSong : song
        );
      });
      
      // OneDrive에 저장 (storage.js의 saveSongs 함수 사용)
      await saveSongs(updatedSongs);

      // songs와 worshipLists를 동시에 업데이트 (OneDrive 저장이 한 번만 실행되도록)
      setSongs(updatedSongs);
      setWorshipLists(updatedWorshipLists);

      // 전체 songs 배열에서도 업데이트 (선택된 곡이 현재 곡인 경우)
      if (previewSong && previewSong.id === editingSong.id) {
        setPreviewSong(updatedSong);
      }

      // 성공 메시지 표시
      showSnackbar('찬양 정보가 성공적으로 업데이트되었습니다.', 'success');

    } catch (error) {
      console.error('찬양 정보 업데이트 실패:', error);
      showSnackbar('찬양 정보 업데이트에 실패했습니다.', 'error');
    } finally {
      setIsUpdating(false); // 업데이트 완료
    }

    setEditingSong(null);
    setEditForm({ title: '', key: '', tempo: '', firstLyrics: '' });
  };

  const handleCancelEdit = () => {
    setEditingSong(null);
    setEditForm({ title: '', key: '', tempo: '', firstLyrics: '', fileName: '', filePath: '' });
    setUploadStatus({ isUploading: false, success: false, error: null, message: '' });
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

  // 파일 업로드 핸들러
  const handleEditFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadStatus({ isUploading: true, success: false, error: null, message: '파일 처리 중...' });

    try {
      const result = await processFileUpload(
        file, 
        editingSong.id, 
        editForm.title, 
        editForm.key
      );
      
      if (result.success) {
        setEditForm(prev => ({
          ...prev,
          fileName: result.fileName,
          filePath: result.filePath
        }));
        
        setUploadStatus({ 
          isUploading: false, 
          success: true, 
          error: null, 
          message: '파일이 성공적으로 업로드되었습니다.' 
        });
      } else {
        setUploadStatus({ 
          isUploading: false, 
          success: false, 
          error: result.error, 
          message: `파일 업로드 실패: ${result.error}` 
        });
      }
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setUploadStatus({ 
        isUploading: false, 
        success: false, 
        error: error.message, 
        message: `파일 업로드 중 오류가 발생했습니다: ${error.message}` 
      });
    }
  };

  // 요일에 따른 찬양 리스트 제목 생성 함수
  const getWorshipListTitle = (date) => {
    const dayOfWeek = date.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const dateStr = format(date, 'M월 d일', { locale: ko });
    
    if (dayOfWeek === 0) { // 일요일
      return `${dateStr} 주일예배 찬양 리스트`;
    } else if (dayOfWeek === 5) { // 금요일
      return `${dateStr} 금요기도회 찬양 리스트`;
    } else {
      return `${dateStr} 찬양 리스트`;
    }
  };

  // PDF 내보내기 함수
  const handleExportPdf = async () => {
    // Electron API 사용 가능 여부 확인
    if (!window.electronAPI) {
      setDialog({
        isVisible: true,
        type: 'error',
        message: 'Electron API를 사용할 수 없습니다. 앱을 다시 시작해주세요.'
      });
      return;
    }

    // 시차 문제를 방지하기 위해 로컬 날짜를 직접 사용
    const currentDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const currentSongs = worshipLists[currentDateKey] || [];
    
    // 디버깅: 앱에서 실제로 로드된 찬양 리스트 확인
    console.log('=== 앱에서 로드된 찬양 리스트 ===');
    console.log('선택된 날짜:', currentDateKey);
    console.log('찬양 개수:', currentSongs.length);
    console.log('찬양 리스트 상세:', currentSongs.map(song => ({
      title: song.title,
      fileName: song.fileName,
      hasFilePath: !!song.filePath,
      filePath: song.filePath
    })));
    
    if (currentSongs.length === 0) {
      setDialog({
        isVisible: true,
        type: 'error',
        message: '선택된 날짜에 찬양이 없습니다.'
      });
      return;
    }

    // 악보가 있는 찬양만 필터링 (fileName이 있으면 filePath가 비어있어도 처리 가능)
    const songsWithMusicSheets = currentSongs.filter(song => song.fileName);
    
    if (songsWithMusicSheets.length === 0) {
      setDialog({
        isVisible: true,
        type: 'error',
        message: '선택된 날짜에 악보가 있는 찬양이 없습니다.'
      });
      return;
    }

    setIsExportingPdf(true);
    
    try {
      const result = await generateWorshipListPDF(songsWithMusicSheets, currentDateKey);
      
      if (result.success) {
        setDialog({
          isVisible: true,
          type: 'success',
          message: result.message
        });
      } else if (result.cancelled) {
        // 사용자가 덮어쓰기를 취소한 경우
        setDialog({
          isVisible: true,
          type: 'info',
          message: result.message
        });
      } else {
        setDialog({
          isVisible: true,
          type: 'error',
          message: `PDF 생성 실패: ${result.error}`
        });
      }
    } catch (error) {
      console.error('PDF 내보내기 오류:', error);
      setDialog({
        isVisible: true,
        type: 'error',
        message: `PDF 내보내기 중 오류가 발생했습니다: ${error.message}`
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getDateClass = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const hasSongs = worshipLists[dateKey] && worshipLists[dateKey].length > 0;
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
    
    return `calendar-day ${hasSongs ? 'has-songs' : ''} ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''}`;
  };

  return (
    <div className="worship-list-page">
      <div className="page-header">
        <h1>
          <Calendar className="header-icon" />
          찬양 리스트
        </h1>
        <p>달력에서 날짜를 선택하여 찬양 리스트를 관리하세요</p>
      </div>

      <div className="worship-list-container">
        <div className="calendar-section">
          <div className="calendar-header">
            <button 
              className="nav-button prev-month"
              onClick={handlePrevMonth}
              title="이전 달"
            >
              <ChevronLeft className="nav-icon" />
            </button>
            <h3>{format(selectedDate, 'yyyy년 M월', { locale: ko })}</h3>
            <button 
              className="nav-button next-month"
              onClick={handleNextMonth}
              title="다음 달"
            >
              <ChevronRight className="nav-icon" />
            </button>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {calendarDays.map(date => (
                <div
                  key={date.toISOString()}
                  className={getDateClass(date)}
                  onClick={() => handleDateClick(date)}
                >
                  <span className="day-number">{format(date, 'd')}</span>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        <div className="list-section">
          <div className="list-header">
            <div className="list-header-left">
              <h3>
                {getWorshipListTitle(selectedDate)}
              </h3>
              {filenameErrorCount > 0 && (
                <span className="filename-error-count">
                  파일이름 에러 ({filenameErrorCount}개)
                </span>
              )}
            </div>
            <div className="list-actions">
              <button
                className="export-pdf-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                title="선택된 날짜의 찬양 리스트를 PDF로 내보내기"
              >
                <Download className="btn-icon" />
                {isExportingPdf ? '생성 중...' : 'PDF'}
              </button>
              <button 
                className="add-song-btn"
                onClick={handleOpenSongSearch}
              >
                <Plus className="btn-icon" />
                곡 추가
              </button>
            </div>
          </div>

          {showSongSearch && (
            <div className="song-search-modal">
              <div className="modal-header">
                <h4>곡 검색</h4>
                <div className="modal-actions">
                  {selectedSongs.length > 0 && (
                    <span className="selected-count">
                      {selectedSongs.length}개 선택됨
                    </span>
                  )}
                  <button 
                    className="close-btn"
                    onClick={handleCloseSearchModal}
                  >
                    <X />
                  </button>
                </div>
              </div>
              
              <div className="search-input-group">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="찬양 이름이나 가사로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="search-results">
                {filteredSongs.map(song => {
                  const isSelected = selectedSongs.some(s => s.id === song.id);
                  const isPreview = previewSong && previewSong.id === song.id;
                  
                  return (
                    <div 
                      key={song.id}
                      className={`search-result-item ${isPreview ? 'preview' : ''} ${isSelected ? 'multi-selected' : ''}`}
                      onClick={() => handleSongClick(song)}
                    >
                      <div 
                        className="song-checkbox"
                        onClick={(e) => handleSongSelect(song, e)}
                      >
                        {isSelected && <div className="checkmark">✓</div>}
                      </div>
                      <div className="song-info">
                        <div className="song-title-row">
                          <h5 className="song-title">{song.title}</h5>
                          <span className="song-key">{song.key}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="preview-actions">
                {selectedSongs.length > 0 ? (
                  <button 
                    className="add-selected-btn"
                    onClick={handleAddSelectedSongs}
                  >
                    <Plus className="btn-icon" />
                    선택한 {selectedSongs.length}개 곡 추가
                  </button>
                ) : previewSong ? (
                  <button 
                    className="add-to-list-btn"
                    onClick={handleAddSong}
                  >
                    <Plus className="btn-icon" />
                    리스트에 추가
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div className="worship-list">
            {currentWorshipList.length === 0 ? (
              <div className="empty-list">
                <Music className="empty-icon" />
                <p>아직 추가된 찬양이 없습니다</p>
                <button 
                  className="btn-secondary"
                  onClick={() => setShowSongSearch(true)}
                >
                  곡 추가하기
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentWorshipList.map(song => song.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="draggable-list">
                    {currentWorshipList.map((song, index) => (
                      <SortableItem
                        key={song.id}
                        song={song}
                        index={index}
                        onRemove={handleRemoveSong}
                        onSelect={setSelectedSong}
                        onEdit={handleEditSong}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
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
              <h3>찬양 정보 수정</h3>
              <button 
                className="close-btn"
                onClick={handleCancelEdit}
              >
                <X />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="edit-form compact-form">
              <div className="form-row compact-row">
                <div className="form-group compact-group full-width">
                  <label className="form-label compact-label">
                    <Music className="label-icon" />
                    찬양 이름 *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    onClick={handleEditInputClick}
                    onFocus={handleEditInputFocus}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-input compact-input full-width"
                    placeholder="찬양 이름을 입력하세요"
                    required
                    autoComplete="off"
                    tabIndex={1}
                  />
                </div>
              </div>

              <div className="form-row compact-row">
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td className="form-cell">
                        <label className="form-label compact-label">코드</label>
                        <select
                          name="key"
                          value={editForm.key}
                          onChange={(e) => setEditForm(prev => ({ ...prev, key: e.target.value }))}
                          className="form-select compact-select"
                          tabIndex={2}
                        >
                          {['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Em', 'Eb', 'F', 'G'].map(key => (
                            <option key={key} value={key}>{key}</option>
                          ))}
                        </select>
                      </td>
                      <td className="form-cell">
                        <label className="form-label compact-label">빠르기</label>
                        <select
                          name="tempo"
                          value={editForm.tempo}
                          onChange={(e) => setEditForm(prev => ({ ...prev, tempo: e.target.value }))}
                          className="form-select compact-select"
                          tabIndex={3}
                        >
                          {['Fast', 'Medium', 'Slow'].map(tempo => (
                            <option key={tempo} value={tempo}>{tempo}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="form-row compact-row">
                <div className="form-group compact-group full-width">
                  <label className="form-label compact-label">첫 가사</label>
                  <input
                    type="text"
                    name="firstLyrics"
                    value={editForm.firstLyrics}
                    onChange={(e) => setEditForm(prev => ({ ...prev, firstLyrics: e.target.value }))}
                    onClick={handleEditInputClick}
                    onFocus={handleEditInputFocus}
                    onMouseDown={handleEditInputMouseDown}
                    className="form-input compact-input full-width"
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
                    악보 파일
                    {editForm.fileName && (
                      <span className="current-file-name">: {editForm.fileName}</span>
                    )}
                    {editForm.fileName && (
                      <button 
                        type="button"
                        className="delete-file-btn-inline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditForm(prev => ({ ...prev, fileName: '', filePath: '' }));
                        }}
                        title="파일 삭제"
                      >
                        <X className="delete-icon" />
                      </button>
                    )}
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
                      className={`file-upload-label compact-upload-label ${uploadStatus.isUploading ? 'uploading' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadStatus.isUploading ? (
                        <>
                          <div className="upload-spinner"></div>
                          <span>처리 중...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="upload-icon" />
                          <span>파일 선택</span>
                        </>
                      )}
                    </label>
                  </div>
                  
                  
                  {uploadStatus.success && (
                    <div className="upload-success-text">
                      파일이 성공적으로 업데이트되었습니다!
                    </div>
                  )}
                  
                  {uploadStatus.error && (
                    <div className="upload-error-text">
                      {uploadStatus.error}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="edit-modal-actions">
                <button 
                  type="button"
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="btn-save"
                  disabled={!editForm.title.trim() || uploadStatus.isUploading}
                >
                  {uploadStatus.isUploading ? '처리 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF 내보내기 다이얼로그 */}
      <GhibliDialog
        isVisible={dialog.isVisible}
        type={dialog.type}
        message={dialog.message}
        onClose={() => setDialog({ isVisible: false, type: 'success', message: '' })}
      />
    </div>
  );
};

export default WorshipList;
