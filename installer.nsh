; WorshipNote NSIS Installer Script
; 기존 앱 자동 제거 및 설치 옵션

!macro customInstall
  ; 기존 WorshipNote 설치 확인
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
  StrCmp $0 "" skipUninstall
  
  ; 기존 설치가 있으면 사용자에게 확인
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 "WorshipNote가 이미 설치되어 있습니다.$\n$\n기존 앱을 제거하고 새 버전을 설치하시겠습니까?$\n$\n• 예: 기존 앱을 제거하고 새 버전 설치$\n• 아니오: 설치를 취소합니다" IDYES doUninstall IDNO cancelInstall
  
  doUninstall:
    ; 진행 상황 표시
    DetailPrint "기존 WorshipNote를 제거하는 중..."
    
    ; 기존 앱이 실행 중이면 종료 시도
    ExecWait "taskkill /f /im WorshipNote.exe" $1
    Sleep 1000
    
    ; 제거 프로그램 실행 (조용한 모드)
    DetailPrint "기존 설치를 제거하는 중..."
    ExecWait '"$0" /S' $1
    Sleep 3000
    
    ; 제거 완료 확인
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
    StrCmp $0 "" uninstallSuccess uninstallFailed
    
    uninstallSuccess:
      MessageBox MB_OK|MB_ICONINFORMATION "기존 WorshipNote가 성공적으로 제거되었습니다.$\n새 버전을 설치합니다."
      Goto skipUninstall
      
    uninstallFailed:
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "기존 WorshipNote 제거에 실패했습니다.$\n$\n수동으로 제거 후 다시 설치하시겠습니까?$\n$\n• 예: 설치를 계속 진행$\n• 아니오: 설치를 취소합니다" IDYES skipUninstall IDNO cancelInstall
  
  cancelInstall:
    MessageBox MB_OK|MB_ICONINFORMATION "설치가 취소되었습니다."
    Abort
  
  skipUninstall:
!macroend

