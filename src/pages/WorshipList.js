import React, { useState, useMemo, useEffect } from 'react';
import { useSnackbar } from '../hooks/useSnackbar';
import Snackbar from '../components/Snackbar';
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
import { Calendar, Plus, Music, Search, X, GripVertical, ChevronLeft, ChevronRight, Edit3, Download, FileText, Upload, AlertTriangle, Trash2, CheckCircle, Check, Save } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { saveWorshipLists, saveSongs, checkFileExists } from '../utils/storage';
import { generateWorshipListPDF } from '../utils/pdfExporter';
import { processFileUpload } from '../utils/fileConverter';
import { isCorrectFileName, updateFileNameForSong } from '../utils/fileNameUtils';
import GhibliDialog from '../components/GhibliDialog';
import './WorshipList.css';

// SortableItem 컴포넌트
const SortableItem = ({ song, index, onRemove, onSelect, onEdit, isFileExistenceLoaded }) => {
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
        </div>
      </div>
      
      {/* 오른쪽 아이콘들을 위한 고정 컨테이너 */}
      <div className="song-actions">
        {/* 악보 상태 아이콘과 코드 아이콘 */}
        <div className="music-sheet-status">
          {isFileExistenceLoaded ? (
            song.fileName ? (
              isCorrectFileName(song.fileName) ? (
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
                <FileText className="status-icon no-file-icon" />
              </div>
            )
          ) : null}
          {song.chord && song.chord.trim() && (
            <span className="song-key-icon">{song.chord}</span>
          )}
        </div>
        <button 
          className="edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit && onEdit(song);
          }}
          title="찬양 정보 수정"
        >
          <Edit3 className="edit-icon" size={14} />
        </button>
        <button 
          className="remove-btn"
          onClick={() => onRemove(song.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const WorshipList = ({ songs, worshipLists, setWorshipLists, setSelectedSong, setSongs, fileExistenceMap, setFileExistenceMap, selectedWorshipListDate, setSelectedWorshipListDate, isFileExistenceLoaded }) => {
  const { snackbar, showSnackbar } = useSnackbar();
  
  // 가장 최근 찬양 리스트가 있는 날짜를 찾는 함수
  const getLatestWorshipListDate = () => {
    const dates = Object.keys(worshipLists).filter(date => 
      date !== 'lastUpdated' && worshipLists[date] && worshipLists[date].length > 0
    );
    
    if (dates.length === 0) {
      return new Date(); // 찬양 리스트가 없으면 오늘 날짜 반환
    }
    
    // 날짜를 정렬하여 가장 최근 날짜 반환 (시차 문제 해결)
    const sortedDates = dates.sort((a, b) => {
      // YYYY-MM-DD 형식의 문자열을 직접 비교하여 시차 문제 방지
      return b.localeCompare(a);
    });
    
    // 가장 최근 날짜를 Date 객체로 변환 (로컬 시간대 사용)
    const latestDateString = sortedDates[0];
    const [year, month, day] = latestDateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month는 0부터 시작하므로 -1
  };
  
  const [selectedDate, setSelectedDate] = useState(() => selectedWorshipListDate || getLatestWorshipListDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [previewSong, setPreviewSong] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [selectionOrder, setSelectionOrder] = useState([]);
  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({ 
    title: '', 
    chord: '', 
    tempo: '', 
    firstLyrics: '', 
    fileName: '', 
    filePath: '' 
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    success: false,
    error: null,
    message: ''
  });
  const [dialog, setDialog] = useState({ isVisible: false, type: 'success', message: '', filePath: null });

  // 수동 저장 함수
  const handleSaveWorshipList = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // 데이터 유효성 검사
      if (!validateWorshipListData(worshipLists)) {
        showSnackbar('error', '저장할 데이터에 오류가 있습니다.');
        return;
      }
      
      // 찬양 리스트 저장
      const success = await saveWorshipLists(worshipLists);
      
      if (success) {
        setHasUnsavedChanges(false);
        showSnackbar('success', '찬양 리스트가 저장되었습니다.');
      } else {
        showSnackbar('error', '찬양 리스트 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('찬양 리스트 저장 실패:', error);
      showSnackbar('error', '찬양 리스트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 찬양 리스트 데이터 유효성 검사
  const validateWorshipListData = (worshipListsData) => {
    if (!worshipListsData || typeof worshipListsData !== 'object') {
      console.error('찬양 리스트 데이터가 유효하지 않습니다:', worshipListsData);
      return false;
    }

    // 각 날짜별 찬양 리스트 검사
    Object.keys(worshipListsData).forEach(dateKey => {
      if (dateKey === 'lastUpdated') return; // 메타데이터는 제외
      
      const worshipList = worshipListsData[dateKey];
      if (!Array.isArray(worshipList)) {
        console.error(`날짜 ${dateKey}의 찬양 리스트가 배열이 아닙니다:`, worshipList);
        return false;
      }

      // 각 찬양 항목 검사
      worshipList.forEach((song, index) => {
        if (!song || typeof song !== 'object') {
          console.error(`날짜 ${dateKey}의 ${index}번째 찬양이 유효하지 않습니다:`, song);
          return false;
        }
        if (!song.id || !song.title) {
          console.error(`날짜 ${dateKey}의 ${index}번째 찬양에 필수 필드가 없습니다:`, song);
          return false;
        }
      });
    });

    return true;
  };

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
            hasChanges = true;
            return latestSong;
          }
          return song;
        });
      });

      if (hasChanges) {
        showSnackbar('success', '찬양 리스트가 최신 정보로 업데이트되었습니다.');
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

  // worshipLists가 변경될 때 가장 최근 날짜로 selectedDate 업데이트 (초기 로드시에만)
  React.useEffect(() => {
    if (isInitialLoad) {
      // selectedWorshipListDate가 이미 설정되어 있으면 그것을 사용, 아니면 최신 날짜 사용
      const dateToUse = selectedWorshipListDate || getLatestWorshipListDate();
      setSelectedDate(dateToUse);
      if (!selectedWorshipListDate) {
        setSelectedWorshipListDate(dateToUse);
      }
      setIsInitialLoad(false);
    }
  }, [worshipLists, isInitialLoad, selectedWorshipListDate]);

  // selectedWorshipListDate가 변경될 때 selectedDate 동기화
  React.useEffect(() => {
    if (selectedWorshipListDate && !isSameDay(selectedDate, selectedWorshipListDate)) {
      setSelectedDate(selectedWorshipListDate);
    }
  }, [selectedWorshipListDate]);

  // 페이지를 벗어날 때 저장되지 않은 변경사항 경고
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '저장되지 않은 변경사항이 있습니다. 정말 페이지를 떠나시겠습니까?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);


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

  // 시차 문제를 방지하기 위해 로컬 날짜를 직접 사용 (메모이제이션으로 최적화)
  const currentDateKey = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);
  
  const currentWorshipList = useMemo(() => {
    return worshipLists[currentDateKey] || [];
  }, [worshipLists, currentDateKey]);




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
    setSelectedWorshipListDate(date);
    setShowSongSearch(false);
  };

  const handlePrevMonth = () => {
    const newDate = subDays(startOfMonth(selectedDate), 1);
    setSelectedDate(newDate);
    setSelectedWorshipListDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = addDays(endOfMonth(selectedDate), 1);
    setSelectedDate(newDate);
    setSelectedWorshipListDate(newDate);
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
  const handleAddSelectedSongs = async () => {
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
      
      // 상태 업데이트 (저장하지 않음)
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      
      // 변경사항 플래그 설정
      setHasUnsavedChanges(true);
      
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

  const handleAddSong = async () => {
    if (previewSong) {
      // 원본 데이터베이스에서 최신 정보를 가져와서 사용
      const latestSong = songs.find(song => song.id === previewSong.id) || previewSong;
      
      const newList = [...currentWorshipList, latestSong];
      
      // 상태 업데이트 (저장하지 않음)
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      
      // 변경사항 플래그 설정
      setHasUnsavedChanges(true);
      
      setShowSongSearch(false);
      setSearchTerm('');
      setPreviewSong(null);
    }
  };

  const handleRemoveSong = async (songId) => {
    const newList = currentWorshipList.filter(song => song.id !== songId);
    
    // 상태 업데이트 (저장하지 않음)
    setWorshipLists(prev => ({
      ...prev,
      [currentDateKey]: newList
    }));
    
    // 변경사항 플래그 설정
    setHasUnsavedChanges(true);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = currentWorshipList.findIndex(song => song.id === active.id);
      const newIndex = currentWorshipList.findIndex(song => song.id === over.id);
      
      const newList = arrayMove(currentWorshipList, oldIndex, newIndex);
      
      // 상태 업데이트 (저장하지 않음)
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      
      // 변경사항 플래그 설정
      setHasUnsavedChanges(true);
    }
  };

  const handleEditSong = (song) => {
    setEditingSong(song);
    setEditForm({
      title: song.title,
      chord: song.chord || '',
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
      chord: editForm.chord.trim(),
      tempo: editForm.tempo.trim(),
      firstLyrics: editForm.firstLyrics.trim(),
      fileName: editForm.fileName,
      filePath: editForm.filePath,
      updatedAt: new Date().toISOString()
    };

    try {
      setIsUpdating(true); // 업데이트 시작
      
      // 파일명 업데이트 (찬양 이름이나 코드가 변경된 경우)
      let finalUpdatedSong = updatedSong;
      console.log('=== WorshipList 파일명 업데이트 시작 ===');
      console.log('editingSong.fileName:', editingSong.fileName);
      console.log('editingSong.title:', editingSong.title, '-> updatedSong.title:', updatedSong.title);
      console.log('editingSong.chord:', editingSong.chord, '-> updatedSong.chord:', updatedSong.chord);
      
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
      
      // 원본 데이터베이스에서 해당 곡 찾아서 업데이트
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
      
      // OneDrive에 저장 (storage.js의 saveSongs 함수 사용)
      await saveSongs(updatedSongs);

      // songs와 worshipLists를 동시에 업데이트 (OneDrive 저장이 한 번만 실행되도록)
      setSongs(updatedSongs);
      setWorshipLists(updatedWorshipLists);
      
      // 찬양 리스트 변경사항 플래그 설정
      setHasUnsavedChanges(true);

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

      // 전체 songs 배열에서도 업데이트 (선택된 곡이 현재 곡인 경우)
      if (previewSong && previewSong.id === editingSong.id) {
        setPreviewSong(updatedSong);
      }

      // 성공 메시지 표시
      showSnackbar('success', '찬양 정보가 성공적으로 업데이트되었습니다.');

    } catch (error) {
      console.error('찬양 정보 업데이트 실패:', error);
      showSnackbar('error', '찬양 정보 업데이트에 실패했습니다.');
    } finally {
      setIsUpdating(false); // 업데이트 완료
    }

    setEditingSong(null);
    setEditForm({ title: '', chord: '', tempo: '', firstLyrics: '' });
  };

  const handleCancelEdit = () => {
    setEditingSong(null);
    setEditForm({ title: '', chord: '', tempo: '', firstLyrics: '', fileName: '', filePath: '' });
    setUploadStatus({ isUploading: false, success: false, error: null, message: '' });
  };

  const handleDeleteFile = async () => {
    try {
      // OneDrive에서 실제 파일 삭제
      if (editForm.fileName && window.electronAPI && window.electronAPI.deleteFile) {
        // Music_Sheets 경로를 가져와서 전체 경로 구성
        const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
        const fullPath = `${musicSheetsPath}/${editForm.fileName}`;
        
        const result = await window.electronAPI.deleteFile(fullPath);
        
        if (!result.success) {
          console.error('OneDrive 파일 삭제 실패:', result.error);
          showSnackbar('error', `파일 삭제에 실패했습니다: ${result.error}`);
          return;
        }
      }
      
      // UI에서 파일 정보 제거
      setEditForm(prev => ({
        ...prev,
        fileName: '',
        filePath: ''
      }));
      
      // fileExistenceMap 업데이트
      setFileExistenceMap(prev => ({
        ...prev,
        [editingSong.id]: false
      }));
      
      showSnackbar('success', '악보 파일이 삭제되었습니다.');
    } catch (error) {
      console.error('파일 삭제 중 오류:', error);
      showSnackbar('error', '파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // PDF 파일 열기 함수
  const handleOpenPdfFile = async () => {
    if (!dialog.filePath || !window.electronAPI || !window.electronAPI.openFile) {
      showSnackbar('error', '파일을 열 수 없습니다.');
      return;
    }

    try {
      const result = await window.electronAPI.openFile(dialog.filePath);
      if (result && result.success) {
        showSnackbar('success', 'PDF 파일이 열렸습니다.');
        // 다이얼로그 닫기
        setDialog({ isVisible: false, type: 'success', message: '', filePath: null });
      } else {
        showSnackbar('error', 'PDF 파일 열기에 실패했습니다.');
      }
    } catch (error) {
      console.error('PDF 파일 열기 중 오류:', error);
      showSnackbar('error', 'PDF 파일 열기 중 오류가 발생했습니다.');
    }
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
        editForm.chord
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

    // 저장되지 않은 변경사항이 있으면 먼저 저장
    if (hasUnsavedChanges) {
      try {
        // 데이터 유효성 검사
        if (!validateWorshipListData(worshipLists)) {
          setDialog({
            isVisible: true,
            type: 'error',
            message: '저장할 데이터에 오류가 있습니다. PDF 내보내기를 중단합니다.'
          });
          return;
        }
        
        // 찬양 리스트 저장
        const saveSuccess = await saveWorshipLists(worshipLists);
        
        if (!saveSuccess) {
          setDialog({
            isVisible: true,
            type: 'error',
            message: '찬양 리스트 저장에 실패했습니다. PDF 내보내기를 중단합니다.'
          });
          return;
        }
        
        // 저장 완료 후 변경사항 플래그 초기화
        setHasUnsavedChanges(false);
        showSnackbar('success', '찬양 리스트가 저장되었습니다. PDF 내보내기를 시작합니다.');
        
      } catch (error) {
        console.error('찬양 리스트 저장 실패:', error);
        setDialog({
          isVisible: true,
          type: 'error',
          message: '찬양 리스트 저장 중 오류가 발생했습니다. PDF 내보내기를 중단합니다.'
        });
        return;
      }
    }

    // 시차 문제를 방지하기 위해 로컬 날짜를 직접 사용
    const currentDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const currentSongs = worshipLists[currentDateKey] || [];
    
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
          message: result.message,
          filePath: result.filePath
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

        <div className={`list-section ${currentWorshipList.length > 0 ? 'has-save-button' : ''}`}>
          <div className="list-header">
            <div className="list-header-left">
              <h3>
                {getWorshipListTitle(selectedDate)}
              </h3>
            </div>
            <div className="list-actions">
              <button 
                className={`save-btn ${hasUnsavedChanges ? 'has-changes' : ''}`}
                onClick={handleSaveWorshipList}
                disabled={isSaving || !hasUnsavedChanges}
                title={hasUnsavedChanges ? "찬양 리스트 저장하기" : "저장됨"}
              >
                {isSaving ? (
                  <div className="save-spinner"></div>
                ) : (
                  <Save className="save-icon" />
                )}
              </button>
              <button
                className="export-pdf-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                title={hasUnsavedChanges ? "저장되지 않은 변경사항이 있습니다. PDF 내보내기 시 자동으로 저장됩니다." : "선택된 날짜의 찬양 리스트를 PDF로 내보내기"}
              >
                <Download className="btn-icon" />
                {isExportingPdf ? '생성 중...' : 'PDF'}
              </button>
              <button 
                className="add-song-btn"
                onClick={handleOpenSongSearch}
                title="찬양 추가하기"
              >
                <Plus className="btn-icon" />
              </button>
            </div>
          </div>

          {showSongSearch && (
            <div className="song-search-modal">
              <div className="modal-header">
                <h4>곡 검색</h4>
                <div className="modal-actions">
                  <button 
                    className={`add-to-list-btn ${selectedSongs.length === 0 ? 'disabled' : ''}`}
                    onClick={selectedSongs.length > 0 ? handleAddSelectedSongs : undefined}
                    disabled={selectedSongs.length === 0}
                  >
                    <Plus className="btn-icon" />
                    {selectedSongs.length > 1 ? `${selectedSongs.length}개 곡 추가` : '리스트에 추가'}
                  </button>
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
                          {song.chord && (
                            <span className="song-key-icon">{song.chord}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="preview-actions">
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
                        isFileExistenceLoaded={isFileExistenceLoaded}
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
                    value={editForm.chord}
                    onChange={(e) => setEditForm(prev => ({ ...prev, chord: e.target.value }))}
                    className="form-select compact-select"
                    tabIndex={3}
                  >
                    <option value="">선택하세요</option>
                    {['A', 'Ab', 'B', 'Bb', 'C', 'D', 'E', 'Em', 'Eb', 'F', 'G'].map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group compact-group">
                  <label className="form-label compact-label">빠르기</label>
                  <select
                    name="tempo"
                    value={editForm.tempo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tempo: e.target.value }))}
                    className="form-select compact-select"
                    tabIndex={4}
                  >
                    <option value="">선택하세요</option>
                    {['Fast', 'Medium', 'Slow'].map(tempo => (
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
                  value={editForm.firstLyrics}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstLyrics: e.target.value }))}
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
                          handleDeleteFile();
                        }}
                        title="파일 삭제"
                      >
                        <X className="delete-icon" />
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
                          <span>{editForm.fileName}</span>
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
        onClose={() => setDialog({ isVisible: false, type: 'success', message: '', filePath: null })}
      >
        {dialog.type === 'success' && dialog.filePath && (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              className="ghibli-dialog-button"
              onClick={handleOpenPdfFile}
              style={{ 
                background: 'linear-gradient(145deg, #4a7c59, #6b8e6b)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📂 PDF 파일 열기
            </button>
            <button 
              className="ghibli-dialog-button"
              onClick={() => setDialog({ isVisible: false, type: 'success', message: '', filePath: null })}
              style={{ 
                background: 'linear-gradient(145deg, #f5f5f5, #e0e0e0)',
                color: '#333',
                border: '2px solid #4a7c59',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              닫기
            </button>
          </div>
        )}
      </GhibliDialog>
      
      <Snackbar 
        isVisible={snackbar.isVisible}
        type={snackbar.type}
        message={snackbar.message}
      />
    </div>
  );
};

export default WorshipList;
