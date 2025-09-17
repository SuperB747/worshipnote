# 한글 폰트 설정 가이드

## 폰트 다운로드 및 설치

### 1. Pretendard 폰트 다운로드 (권장)

**다운로드 링크**: https://github.com/orioncactus/pretendard/releases

**필요한 파일들**:
- `Pretendard-Regular.woff2`
- `Pretendard-Regular.woff`
- `Pretendard-Regular.ttf`
- `Pretendard-Medium.woff2`
- `Pretendard-Medium.woff`
- `Pretendard-Medium.ttf`
- `Pretendard-SemiBold.woff2`
- `Pretendard-SemiBold.woff`
- `Pretendard-SemiBold.ttf`
- `Pretendard-Bold.woff2`
- `Pretendard-Bold.woff`
- `Pretendard-Bold.ttf`

### 2. 폰트 파일 저장 위치

```
/Users/brian/Desktop/worshipnote/public/fonts/
├── Pretendard-Regular.woff2
├── Pretendard-Regular.woff
├── Pretendard-Regular.ttf
├── Pretendard-Medium.woff2
├── Pretendard-Medium.woff
├── Pretendard-Medium.ttf
├── Pretendard-SemiBold.woff2
├── Pretendard-SemiBold.woff
├── Pretendard-SemiBold.ttf
├── Pretendard-Bold.woff2
├── Pretendard-Bold.woff
└── Pretendard-Bold.ttf
```

### 3. 대안 폰트 옵션

#### A. Noto Sans KR (Google Fonts)
```bash
# CDN 사용 (인터넷 연결 필요)
# CSS에서 @import 사용
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
```

#### B. 시스템 폰트 사용
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
}
```

### 4. 폰트 최적화 팁

1. **WOFF2 우선 사용**: 가장 압축률이 좋음
2. **font-display: swap**: 빠른 로딩을 위한 폰트 교체
3. **폴백 폰트 설정**: 폰트 로딩 실패 시 대체 폰트
4. **필요한 weight만 포함**: 앱에서 사용하는 굵기만 포함

### 5. 빌드 시 폰트 포함 확인

Electron 앱 빌드 시 `public/fonts/` 폴더의 모든 파일이 포함되는지 확인하세요.

```bash
npm run build
# 빌드 후 dist/fonts/ 폴더에 폰트 파일들이 있는지 확인
```

## 폰트 적용 확인

앱을 실행한 후 개발자 도구에서 폰트가 올바르게 로드되었는지 확인:

1. F12로 개발자 도구 열기
2. Network 탭에서 폰트 파일 로딩 확인
3. Elements 탭에서 computed styles에서 font-family 확인
