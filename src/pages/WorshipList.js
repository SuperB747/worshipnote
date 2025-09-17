import React, { useState, useMemo } from 'react';
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
import { Calendar, Plus, Music, Search, X, GripVertical, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { saveWorshipLists } from '../utils/storage';
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
      
      <div className="song-content">
        <div className="song-number">{index + 1}</div>
        <div 
          className="song-details"
          onClick={(e) => {
            e.stopPropagation();
            onSelect && onSelect(song);
          }}
        >
          <h5 className="song-title">{song.title}</h5>
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [previewSong, setPreviewSong] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', key: '', tempo: '', firstLyrics: '' });

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

  const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
  const currentWorshipList = worshipLists[currentDateKey] || [];

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

  // 다중 선택 핸들러
  const handleSongSelect = (song, event) => {
    event.stopPropagation();
    
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd 키가 눌린 상태에서 클릭
      setSelectedSongs(prev => {
        const isSelected = prev.some(s => s.id === song.id);
        if (isSelected) {
          // 이미 선택된 곡이면 선택 해제
          return prev.filter(s => s.id !== song.id);
        } else {
          // 선택되지 않은 곡이면 선택에 추가
          return [...prev, song];
        }
      });
    } else {
      // Ctrl/Cmd 키가 안 눌린 상태에서 클릭
      setSelectedSongs([song]);
    }
  };

  // 선택된 곡들을 리스트에 추가
  const handleAddSelectedSongs = () => {
    if (selectedSongs.length === 0) return;

    const newSongs = selectedSongs.filter(song => 
      !currentWorshipList.some(existingSong => existingSong.id === song.id)
    );

    if (newSongs.length > 0) {
      const newList = [...currentWorshipList, ...newSongs];
      setWorshipLists(prev => ({
        ...prev,
        [currentDateKey]: newList
      }));
      
      // 선택 초기화
      setSelectedSongs([]);
      setShowSongSearch(false);
      setPreviewSong(null);
    }
  };

  // 검색 모달 닫을 때 선택 초기화
  const handleCloseSearchModal = () => {
    setShowSongSearch(false);
    setPreviewSong(null);
    setSelectedSongs([]);
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
      const newList = [...currentWorshipList, { ...previewSong, id: Date.now() }];
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
      key: song.key || '',
      tempo: song.tempo || '',
      firstLyrics: song.firstLyrics || ''
    });
  };

  const handleSaveEdit = () => {
    if (!editingSong || !editForm.title.trim()) return;

    const updatedSong = {
      ...editingSong,
      title: editForm.title.trim(),
      key: editForm.key.trim(),
      tempo: editForm.tempo.trim(),
      firstLyrics: editForm.firstLyrics.trim(),
      updatedAt: new Date().toISOString()
    };

    // 찬양 리스트에서 해당 곡 업데이트
    const newList = currentWorshipList.map(song => 
      song.id === editingSong.id ? updatedSong : song
    );

    setWorshipLists(prev => ({
      ...prev,
      [currentDateKey]: newList
    }));

    // 전체 songs 배열에서도 업데이트 (선택된 곡이 현재 곡인 경우)
    if (selectedSong && selectedSong.id === editingSong.id) {
      setSelectedSong(updatedSong);
    }

    setEditingSong(null);
    setEditForm({ title: '', key: '', tempo: '' });
  };

  const handleCancelEdit = () => {
    setEditingSong(null);
    setEditForm({ title: '', key: '', tempo: '', firstLyrics: '' });
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
            <h3>
              {format(selectedDate, 'M월 d일', { locale: ko })} 찬양 리스트
            </h3>
            <button 
              className="add-song-btn"
              onClick={handleOpenSongSearch}
            >
              <Plus className="btn-icon" />
              곡 추가
            </button>
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
                ) : (
                  <div className="selection-hint">
                    Ctrl/Cmd + 클릭으로 여러 곡을 선택하세요
                  </div>
                )}
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
            
            <div className="edit-form">
              <div className="form-group">
                <label>제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  onClick={handleEditInputClick}
                  onFocus={handleEditInputFocus}
                  onMouseDown={handleEditInputMouseDown}
                  placeholder="찬양 제목을 입력하세요"
                  className="form-input"
                  autoComplete="off"
                  tabIndex={1}
                />
              </div>
              
              <div className="form-group">
                <label>키</label>
                <input
                  type="text"
                  value={editForm.key}
                  onChange={(e) => setEditForm(prev => ({ ...prev, key: e.target.value }))}
                  onClick={handleEditInputClick}
                  onFocus={handleEditInputFocus}
                  onMouseDown={handleEditInputMouseDown}
                  placeholder="예: C, D, E..."
                  className="form-input"
                  autoComplete="off"
                  tabIndex={2}
                />
              </div>
              
              <div className="form-group">
                <label>빠르기</label>
                <input
                  type="text"
                  value={editForm.tempo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tempo: e.target.value }))}
                  onClick={handleEditInputClick}
                  onFocus={handleEditInputFocus}
                  onMouseDown={handleEditInputMouseDown}
                  placeholder="예: 120, 140..."
                  className="form-input"
                  autoComplete="off"
                  tabIndex={3}
                />
              </div>
              
              <div className="form-group">
                <label>첫 가사</label>
                <textarea
                  value={editForm.firstLyrics}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstLyrics: e.target.value }))}
                  onClick={handleEditInputClick}
                  onFocus={handleEditInputFocus}
                  onMouseDown={handleEditInputMouseDown}
                  placeholder="찬양의 첫 가사를 입력하세요"
                  className="form-textarea"
                  rows="3"
                  autoComplete="off"
                  tabIndex={4}
                />
              </div>
            </div>
            
            <div className="edit-modal-actions">
              <button 
                className="btn-cancel"
                onClick={handleCancelEdit}
              >
                취소
              </button>
              <button 
                className="btn-save"
                onClick={handleSaveEdit}
                disabled={!editForm.title.trim()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorshipList;
