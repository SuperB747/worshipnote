import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, FileText, Clock, Hash, Download, Eye } from 'lucide-react';
import './SongPreview.css';

const SongPreview = ({ selectedSong }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [lastLoadedSongId, setLastLoadedSongId] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef(null);

  const loadImagePreview = useCallback(async () => {
    console.log('=== SongPreview 디버깅 시작 ===');
    console.log('selectedSong:', selectedSong);
    console.log('selectedSong.fileName:', selectedSong?.fileName);
    console.log('selectedSong.filePath:', selectedSong?.filePath);
    
    if (!selectedSong || !selectedSong.fileName) {
      console.log('❌ 악보 파일명이 없습니다.');
      setError('악보 파일명이 없습니다.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setImageLoadError(false);
    
    try {
      console.log('🔍 Electron API 확인 중...');
      console.log('window.electronAPI:', window.electronAPI);
      console.log('window.electronAPI.readFile:', window.electronAPI?.readFile);
      
      if (!window.electronAPI || !window.electronAPI.readFile) {
        console.log('❌ Electron API를 사용할 수 없습니다.');
        throw new Error('Electron API not available');
      }
      
      // Music_Sheets 경로 가져오기
      console.log('📁 Music_Sheets 경로 가져오기 중...');
      const musicSheetsPath = await window.electronAPI.getMusicSheetsPath();
      console.log('musicSheetsPath:', musicSheetsPath);
      
      if (!musicSheetsPath) {
        console.log('❌ Music_Sheets 경로를 찾을 수 없습니다.');
        setError('Music_Sheets 경로를 찾을 수 없습니다.');
        return;
      }
      
      
      // selectedSong이 null이 되지 않도록 보호
      const currentSong = selectedSong;
      if (!currentSong) {
        setError('곡 정보가 없습니다.');
        return;
      }
      
      // 파일 경로 구성 - 플랫폼별 경로 문제 해결
      console.log('🔧 파일 경로 구성 중...');
      console.log('currentSong.filePath:', currentSong.filePath);
      console.log('currentSong.fileName:', currentSong.fileName);
      
      let filePath;
      
      // filePath가 있고 다른 플랫폼 경로인 경우, 현재 플랫폼에 맞게 변환
      if (currentSong.filePath) {
        // Windows 경로인지 확인 (C:\ 또는 D:\ 등)
        const isWindowsPath = /^[A-Za-z]:[\\/]/.test(currentSong.filePath) || currentSong.filePath.includes('\\');
        const isMacPath = currentSong.filePath.startsWith('/') && !currentSong.filePath.includes('\\');
        
        console.log('isWindowsPath:', isWindowsPath);
        console.log('isMacPath:', isMacPath);
        
        if (isWindowsPath) {
          // Windows 경로를 현재 플랫폼 경로로 변환
          const fileName = currentSong.fileName || currentSong.filePath.split(/[\\/]/).pop();
          filePath = `${musicSheetsPath}/${fileName}`;
          console.log('Windows 경로 변환:', filePath);
        } else if (isMacPath) {
          // macOS 경로이지만 다른 위치인 경우, 현재 musicSheetsPath 사용
          const fileName = currentSong.fileName || currentSong.filePath.split('/').pop();
          filePath = `${musicSheetsPath}/${fileName}`;
          console.log('macOS 경로 변환:', filePath);
        } else {
          // 상대 경로인 경우
          filePath = `${musicSheetsPath}/${currentSong.filePath}`;
          console.log('상대 경로 사용:', filePath);
        }
      } else {
        // filePath가 없는 경우 fileName 사용
        filePath = `${musicSheetsPath}/${currentSong.fileName}`;
        console.log('fileName만 사용:', filePath);
      }
      
      console.log('✅ 최종 filePath:', filePath);
      
      // OneDrive 동기화 상태 확인
      if (window.electronAPI && window.electronAPI.checkOneDriveSync) {
        try {
          const syncStatus = await window.electronAPI.checkOneDriveSync(filePath);
          if (syncStatus.success && syncStatus.isOneDrive && !syncStatus.isSynced) {
            setError(`OneDrive 파일이 로컬에 동기화되지 않았습니다.\n\n파일: ${currentSong.fileName}\n경로: ${filePath}\n\n해결 방법:\n1. OneDrive에서 파일을 "항상 이 기기에서 사용 가능"으로 설정\n2. 파일을 로컬 폴더로 복사\n3. OneDrive 동기화 상태 확인`);
            return;
          }
        } catch (error) {
          // 동기화 상태 확인 실패 시 무시하고 계속 진행
        }
      }
      
      // Music_Sheets 폴더에서 정확한 파일명을 찾지 못했다면 비슷한 파일명으로 시도
      if (window.electronAPI && window.electronAPI.listFiles) {
        try {
          const files = await window.electronAPI.listFiles(musicSheetsPath);
          const exactMatch = files.find(file => file === currentSong.fileName);
          
          if (!exactMatch) {
            const similarFiles = files.filter(file => 
              file.toLowerCase().includes(currentSong.fileName.toLowerCase()) ||
              currentSong.fileName.toLowerCase().includes(file.toLowerCase())
            );
            
            if (similarFiles.length > 0) {
              const newFileName = similarFiles[0];
              filePath = `${musicSheetsPath}/${newFileName}`;
            }
          }
        } catch (error) {
          // 파일명 매칭 실패 시 무시
        }
      }
      
      
      try {
        console.log('📖 파일 읽기 시작:', filePath);
        
        // 파일 존재 여부 먼저 확인
        if (window.electronAPI && window.electronAPI.checkFileExists) {
          console.log('🔍 파일 존재 여부 확인 중...');
          const exists = await window.electronAPI.checkFileExists(filePath);
          console.log('파일 존재 여부:', exists);
          if (!exists) {
            throw new Error(`파일이 존재하지 않습니다: ${filePath}`);
          }
        }
        
        console.log('📖 readFile 호출 중...');
        const readResult = await window.electronAPI.readFile(filePath);
        console.log('📖 readFile 결과:', readResult);
        console.log('readResult 타입:', typeof readResult);
        console.log('readResult.success:', readResult?.success);
        console.log('readResult.data:', readResult?.data);
        console.log('readResult.data 타입:', typeof readResult?.data);
        console.log('readResult.data 길이:', readResult?.data?.byteLength);
        
        // readResult에서 실제 데이터 추출
        if (readResult && readResult.success && readResult.data) {
          const fileData = readResult.data;
          console.log('✅ 파일 데이터 추출 성공:', fileData);
          console.log('fileData byteLength:', fileData.byteLength);
          
          if (fileData.byteLength > 0) {
            console.log('✅ 파일 데이터 읽기 성공, 이미지 URL 생성 중...');
            // 파일 확장자에 따라 MIME 타입 결정
            const extension = currentSong.fileName.toLowerCase().split('.').pop();
            let mimeType = 'image/jpeg'; // 기본값
            
            switch (extension) {
              case 'jpg':
              case 'jpeg':
                mimeType = 'image/jpeg';
                break;
              case 'png':
                mimeType = 'image/png';
                break;
              case 'pdf':
                mimeType = 'application/pdf';
                break;
              default:
                // 알 수 없는 파일 확장자는 JPEG로 처리
            }
            
            console.log('🔧 Blob 생성 중...', 'mimeType:', mimeType);
            const blob = new Blob([fileData], { type: mimeType });
            console.log('🔧 Blob 생성 완료:', blob);
            
            const url = URL.createObjectURL(blob);
            console.log('✅ 이미지 URL 생성 완료:', url);
            
            // 이전 URL 정리
            if (imageUrl) {
              URL.revokeObjectURL(imageUrl);
            }
            
            // 상태 설정
            setImageUrl(url);
            setImageLoaded(false);
            setLastLoadedSongId(currentSong.id);
            console.log('✅ 이미지 상태 설정 완료');
          } else {
            throw new Error('파일이 비어있습니다');
          }
        } else {
          throw new Error('파일 읽기 실패');
        }
      } catch (fileError) {
        console.error('❌ 파일 읽기 오류 발생:', fileError);
        console.error('오류 메시지:', fileError.message);
        console.error('오류 스택:', fileError.stack);
        setError(`파일을 읽을 수 없습니다: ${fileError.message}`);
      }
    } catch (error) {
      console.error('❌ 전체 미리보기 로드 실패:', error);
      console.error('오류 메시지:', error.message);
      console.error('오류 스택:', error.stack);
      setError(`미리보기 로드 실패: ${error.message}`);
    } finally {
      console.log('🏁 loadImagePreview 완료');
      setLoading(false);
    }
  }, [selectedSong, imageUrl]);

  useEffect(() => {
    if (selectedSong && selectedSong.fileName) {
      // 같은 곡이면 다시 로드하지 않음
      if (lastLoadedSongId === selectedSong.id) {
        return;
      }
      loadImagePreview();
    } else {
      // 선택된 곡이 없으면 모든 상태 초기화
      setImageUrl(null);
      setError(null);
      setImageLoadError(false);
      setLoading(false);
      setLastLoadedSongId(null);
    }
  }, [selectedSong, loadImagePreview, lastLoadedSongId]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleDownload = () => {
    if (imageUrl) {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `${selectedSong.fileName || '악보'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleImageLoadError = (e) => {
    setImageLoadError(true);
    setError('이미지를 표시할 수 없습니다. 파일 형식을 확인해주세요.');
  };

  if (!selectedSong) {
    return (
      <div className="song-preview">
        <div className="preview-placeholder">
          <Music className="placeholder-icon" />
          <h3>악보 미리보기</h3>
          <p>곡을 선택하면 여기에 악보가 표시됩니다</p>
        </div>
      </div>
    );
  }

  // 렌더링할 내용 결정
  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>악보를 불러오는 중...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="error-container">
          <FileText className="error-icon" />
          <p>{error}</p>
          <div className="error-details">
            <p>곡: {selectedSong?.title}</p>
            <p>파일: {selectedSong?.fileName}</p>
          </div>
          <button 
            className="retry-btn"
            onClick={loadImagePreview}
          >
            다시 시도
          </button>
        </div>
      );
    }
    
    if (imageLoadError) {
      return (
        <div className="error-container">
          <FileText className="error-icon" />
          <p>이미지를 불러올 수 없습니다.</p>
          <div className="error-details">
            <p>곡: {selectedSong?.title}</p>
            <p>파일: {selectedSong?.fileName}</p>
            <p>파일 형식을 확인해주세요.</p>
          </div>
          <button 
            className="retry-btn"
            onClick={loadImagePreview}
          >
            다시 시도
          </button>
        </div>
      );
    }
    
    if (imageUrl) {
      return (
        <div className="image-container">
          <div className="image-viewer">
            <img
              key={`image-${selectedSong?.id}-${imageUrl}`}
              ref={imageRef}
              src={imageUrl}
              alt="악보 미리보기"
              className="score-image"
              onError={handleImageLoadError}
              onLoad={() => {
                setImageLoaded(true);
                if (imageRef.current) {
                  const img = imageRef.current;
                  const container = img.parentElement;
                  const containerWidth = container.clientWidth;
                  const containerHeight = container.clientHeight;
                  
                  // 이미지 비율 계산
                  const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                  const containerAspectRatio = containerWidth / containerHeight;
                  
                  if (imgAspectRatio > containerAspectRatio) {
                    // 이미지가 더 넓음 - 너비에 맞춤
                    img.style.width = '100%';
                    img.style.height = 'auto';
                  } else {
                    // 이미지가 더 높음 - 높이에 맞춤
                    img.style.width = 'auto';
                    img.style.height = '100%';
                  }
                }
              }}
            />
          </div>
        </div>
      );
    }
    
    // 기본 플레이스홀더
    return (
      <div className="score-placeholder">
        <Music className="score-icon" />
        <p>악보 파일이 없습니다</p>
        {selectedSong.fileName && (
          <div className="file-info">
            <span>파일: {selectedSong.fileName}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="song-preview">
      <div className="score-preview">
        {renderContent()}
      </div>
    </div>
  );
};

export default SongPreview;