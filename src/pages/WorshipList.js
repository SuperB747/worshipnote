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
import { Calendar, Plus, Music, Search, X, GripVertical, Download, RotateCcw, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createDatabaseBackup, restoreDatabaseFromBackup, migrateFromExcel, saveWorshipLists } from '../utils/storage';
import './WorshipList.css';

// SortableItem 컴포넌트
const SortableItem = ({ song, index, onRemove, onSelect }) => {
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
          onSelect(song);
        }}
      >
        <div className="song-number">{index + 1}</div>
        <div className="song-details">
          <h5>{song.title}</h5>
          <p>{song.key} • {song.tempo}</p>
        </div>
        <Music className="song-icon" />
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredSongs = useMemo(() => {
    if (!searchTerm) return songs;
    return songs.filter(song => 
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.firstLyrics.toLowerCase().includes(searchTerm.toLowerCase())
    );
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

  const handleDatabaseBackup = async () => {
    try {
      console.log('통합 데이터베이스 백업 시작...');
      console.log('현재 songs 개수:', songs.length);
      console.log('현재 worshipLists 개수:', Object.keys(worshipLists).length);
      const result = await createDatabaseBackup(songs, worshipLists);
      console.log('통합 데이터베이스 백업 결과:', result);
      
      if (result.success) {
        alert(`데이터베이스 백업이 생성되었습니다!\n${result.message}`);
      } else {
        alert('데이터베이스 백업 생성에 실패했습니다:\n' + result.error);
      }
    } catch (error) {
      console.error('데이터베이스 백업 생성 오류:', error);
      alert('데이터베이스 백업 생성 중 오류가 발생했습니다:\n' + error.message);
    }
  };

  const handleDatabaseRestore = () => {
    // 파일 선택을 위한 input 요소 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        console.log('데이터베이스 복원 시작...');
        const filePath = file.path || file.name; // Electron에서는 file.path 사용

        const result = await restoreDatabaseFromBackup(filePath, setSongs, setWorshipLists);
        console.log('데이터베이스 복원 결과:', result);

        if (result.success) {
          alert(`데이터베이스가 복원되었습니다!\n${result.message}`);
        } else {
          alert('데이터베이스 복원에 실패했습니다:\n' + result.error);
        }
      } catch (error) {
        console.error('데이터베이스 복원 오류:', error);
        alert('데이터베이스 복원 중 오류가 발생했습니다:\n' + error.message);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleExcelMigration = async () => {
    if (!window.confirm('엑셀 파일에서 찬양 리스트를 마이그레이션하시겠습니까?\n\n이 작업은 기존 찬양 리스트를 덮어쓸 수 있습니다.')) {
      return;
    }

    try {
      console.log('엑셀 마이그레이션 시작...');
      const result = await migrateFromExcel(songs);
      console.log('엑셀 마이그레이션 결과:', result);

      if (result.success) {
        // 마이그레이션된 찬양 리스트를 현재 상태에 병합
        const mergedWorshipLists = { ...worshipLists, ...result.worshipLists };
        console.log('병합된 찬양 리스트:', Object.keys(mergedWorshipLists).length, '개 날짜');
        
        // 먼저 React 상태 업데이트
        setWorshipLists(mergedWorshipLists);
        
        // OneDrive에 저장 (약간의 지연 후)
        setTimeout(async () => {
          try {
            console.log('OneDrive에 저장 시작...');
            await saveWorshipLists(mergedWorshipLists);
            console.log('마이그레이션된 찬양 리스트가 OneDrive에 저장되었습니다.');
            
            // 저장 확인을 위해 파일 내용 로그
            const oneDrivePath = await window.electronAPI.getOneDrivePath();
            const filePath = `${oneDrivePath}/worship_lists.json`;
            const fileData = await window.electronAPI.readFile(filePath);
            if (fileData) {
              const savedData = JSON.parse(fileData);
              console.log('저장된 찬양 리스트 개수:', Object.keys(savedData.worshipLists).length);
            }
          } catch (saveError) {
            console.error('OneDrive 저장 실패:', saveError);
            alert('마이그레이션은 완료되었지만 저장에 실패했습니다. 다시 시도해주세요.');
          }
        }, 1000);
        
        alert(result.message);
        
        // 매칭되지 않은 곡이 있으면 상세 정보 표시
        if (result.stats.unmatchedSongs > 0) {
          const unmatchedDetails = result.stats.unmatchedList
            .slice(0, 10) // 처음 10개만 표시
            .map(item => `• ${item.date}: ${item.title}`)
            .join('\n');
          
          const moreCount = result.stats.unmatchedSongs - 10;
          const moreText = moreCount > 0 ? `\n... 및 ${moreCount}개 더` : '';
          
          alert(`매칭되지 않은 곡이 있습니다:\n\n${unmatchedDetails}${moreText}\n\n이 곡들은 악보 데이터베이스에 추가한 후 다시 마이그레이션해주세요.`);
        }
      } else {
        alert('엑셀 마이그레이션에 실패했습니다:\n' + result.error);
      }
    } catch (error) {
      console.error('엑셀 마이그레이션 오류:', error);
      alert('엑셀 마이그레이션 중 오류가 발생했습니다:\n' + error.message);
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
          
          {/* 백업/복원 버튼 섹션 */}
          <div className="backup-section">
            <h4>데이터 관리</h4>
            <div className="backup-actions">
              <button 
                className="backup-btn database-backup"
                onClick={handleDatabaseBackup}
                title="통합 데이터베이스 백업 (찬양 리스트 + 악보 정보)"
              >
                <Download className="btn-icon" />
                통합 백업
              </button>
              <button 
                className="restore-btn database-restore"
                onClick={handleDatabaseRestore}
                title="통합 데이터베이스 복원 (찬양 리스트 + 악보 정보)"
              >
                <RotateCcw className="btn-icon" />
                통합 복원
              </button>
              <button 
                className="migration-btn excel-migration"
                onClick={handleExcelMigration}
                title="엑셀 파일에서 찬양 리스트 마이그레이션"
              >
                <FileSpreadsheet className="btn-icon" />
                엑셀 마이그레이션
              </button>
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
              onClick={() => setShowSongSearch(true)}
            >
              <Plus className="btn-icon" />
              곡 추가
            </button>
          </div>

          {showSongSearch && (
            <div className="song-search-modal">
              <div className="modal-header">
                <h4>곡 검색</h4>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowSongSearch(false);
                    setPreviewSong(null);
                  }}
                >
                  <X />
                </button>
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
                {filteredSongs.map(song => (
                  <div 
                    key={song.id}
                    className={`search-result-item ${previewSong && previewSong.id === song.id ? 'selected' : ''}`}
                    onClick={() => handleSongClick(song)}
                  >
                    <Music className="song-icon" />
                    <div className="song-info">
                      <h5>{song.title}</h5>
                      <p>{song.key} • {song.tempo}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {previewSong && (
                <div className="preview-actions">
                  <button 
                    className="add-to-list-btn"
                    onClick={handleAddSong}
                  >
                    <Plus className="btn-icon" />
                    리스트에 추가
                  </button>
                </div>
              )}
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
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorshipList;
