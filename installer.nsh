; WorshipNote NSIS Installer Script
; 기존 앱 자동 제거 및 설치 옵션

!macro customInstall
  ; 기존 WorshipNote 설치 확인 및 제거
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
  StrCmp $0 "" skipUninstall
  
  ; 기존 설치가 있으면 제거 확인
  MessageBox MB_YESNO|MB_ICONQUESTION "기존 WorshipNote가 설치되어 있습니다.$\n기존 버전을 제거하고 새 버전을 설치하시겠습니까?" IDYES doUninstall IDNO skipUninstall
  
  doUninstall:
    ; 기존 앱 종료 시도
    ExecWait "taskkill /f /im WorshipNote.exe" $1
    
    ; 제거 프로그램 실행
    ExecWait '"$0" /S' $1
    Sleep 2000
    
    ; 제거 완료 확인
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
    StrCmp $0 "" uninstallSuccess uninstallFailed
    
    uninstallSuccess:
      MessageBox MB_OK|MB_ICONINFORMATION "기존 WorshipNote가 성공적으로 제거되었습니다."
      Goto skipUninstall
      
    uninstallFailed:
      MessageBox MB_OK|MB_ICONEXCLAMATION "기존 WorshipNote 제거에 실패했습니다.$\n수동으로 제거 후 다시 설치해주세요."
      Abort
  
  skipUninstall:
!macroend

