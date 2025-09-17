# WorshipNote - 찬양 악보 관리 앱

지브리 스타일의 세련된 디자인으로 제작된 찬양 악보 관리 데스크톱 애플리케이션입니다.

## 🚀 개발 환경 실행

### Electron 개발 모드 (권장)
```bash
npm run dev
```
또는
```bash
npm run electron-dev
```

이 명령어는 다음을 동시에 실행합니다:
1. React 개발 서버 시작 (http://localhost:3000)
2. Electron 앱 실행 (PDF 미리보기 기능 포함)

### 웹 브라우저 모드 (제한적)
```bash
npm start
```
- PDF 미리보기 기능은 Electron 환경에서만 작동합니다.

## 📁 프로젝트 구조

```
worshipnote/
├── public/
│   ├── electron.js          # Electron 메인 프로세스
│   └── preload.js           # Electron preload 스크립트
├── src/
│   ├── components/          # React 컴포넌트
│   ├── pages/              # 페이지 컴포넌트
│   ├── utils/              # 유틸리티 함수
│   └── App.js              # 메인 앱 컴포넌트
└── package.json
```

## 🎵 주요 기능

- **악보 추가**: JPG, PNG, PDF 파일을 PDF로 변환하여 저장
- **악보 검색**: 제목, 가사, 코드, 빠르기로 필터링
- **찬양 리스트**: 달력 기반 찬양 리스트 관리
- **PDF 미리보기**: 선택한 악보의 실시간 미리보기

## 🔧 기술 스택

- **Frontend**: React 18
- **Desktop**: Electron 27
- **PDF 처리**: jsPDF, html2canvas
- **UI**: Lucide React Icons
- **스타일링**: CSS (지브리 스타일)

## 📦 빌드 및 배포

### 개발용 빌드
```bash
npm run build
```

### Electron 앱 패키징
```bash
npm run electron-pack
```

## 🎨 디자인 특징

- 지브리 애니메이션 스타일의 부드러운 색상
- 3컬럼 레이아웃 (사이드바, 콘텐츠, 미리보기)
- 반응형 디자인
- 직관적인 사용자 인터페이스

## 📝 사용법

1. **악보 추가**: 왼쪽 사이드바에서 "악보 추가" 클릭
2. **악보 검색**: "악보 검색"에서 곡을 찾고 선택
3. **미리보기**: 선택한 곡의 악보가 오른쪽에 표시
4. **찬양 리스트**: "찬양 리스트"에서 특정 날짜의 찬양 목록 관리

## 🐛 문제 해결

### PDF 미리보기가 작동하지 않는 경우
- Electron 환경에서 실행 중인지 확인하세요 (`npm run dev`)
- 웹 브라우저에서는 PDF 미리보기가 지원되지 않습니다.

### 파일 저장 오류
- OneDrive 폴더가 존재하는지 확인하세요
- 파일 권한을 확인하세요

## 📄 라이선스

MIT License