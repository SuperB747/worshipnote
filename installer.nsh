; WorshipNote NSIS Installer Script
; 기존 앱 자동 제거 및 설치 옵션

!macro preInit
  ; 기존 WorshipNote 설치 확인
  StrCpy $0 ""
  StrCpy $1 ""
  
  ; 디버깅: 설치 시작 전 기존 앱 확인
  DetailPrint "설치 시작 전 기존 WorshipNote 확인 중..."
  
  ; 방법 1: 표준 HKLM 레지스트리 확인
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
  StrCmp $0 "" checkHKCU foundInstallation
  
  ; 방법 2: HKCU 레지스트리 확인
  checkHKCU:
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
    StrCmp $0 "" checkWOW64 foundInstallation
  
  ; 방법 3: WOW64 레지스트리 확인
  checkWOW64:
    ReadRegStr $0 HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\WorshipNote" "UninstallString"
    StrCmp $0 "" checkProgramFiles foundInstallation
  
  ; 방법 4: Program Files 확인
  checkProgramFiles:
    IfFileExists "$PROGRAMFILES\WorshipNote\WorshipNote.exe" 0 checkProgramFilesX86
    StrCpy $0 "$PROGRAMFILES\WorshipNote\uninstall.exe"
    StrCpy $1 "$PROGRAMFILES\WorshipNote"
    Goto foundInstallation
  
  ; 방법 5: Program Files (x86) 확인
  checkProgramFilesX86:
    IfFileExists "$PROGRAMFILES32\WorshipNote\WorshipNote.exe" 0 checkLocalAppData
    StrCpy $0 "$PROGRAMFILES32\WorshipNote\uninstall.exe"
    StrCpy $1 "$PROGRAMFILES32\WorshipNote"
    Goto foundInstallation
  
  ; 방법 6: LocalAppData 확인
  checkLocalAppData:
    IfFileExists "$LOCALAPPDATA\Programs\WorshipNote\WorshipNote.exe" 0 checkAppData
    StrCpy $0 "$LOCALAPPDATA\Programs\WorshipNote\uninstall.exe"
    StrCpy $1 "$LOCALAPPDATA\Programs\WorshipNote"
    Goto foundInstallation
  
  ; 방법 7: AppData 확인
  checkAppData:
    IfFileExists "$APPDATA\WorshipNote\WorshipNote.exe" 0 checkDesktop
    StrCpy $0 "$APPDATA\WorshipNote\uninstall.exe"
    StrCpy $1 "$APPDATA\WorshipNote"
    Goto foundInstallation
  
  ; 방법 8: Desktop 확인
  checkDesktop:
    IfFileExists "$DESKTOP\WorshipNote\WorshipNote.exe" 0 checkDocuments
    StrCpy $0 "$DESKTOP\WorshipNote\uninstall.exe"
    StrCpy $1 "$DESKTOP\WorshipNote"
    Goto foundInstallation
  
  ; 방법 9: Documents 확인
  checkDocuments:
    IfFileExists "$DOCUMENTS\WorshipNote\WorshipNote.exe" 0 checkDefaultDir
    StrCpy $0 "$DOCUMENTS\WorshipNote\uninstall.exe"
    StrCpy $1 "$DOCUMENTS\WorshipNote"
    Goto foundInstallation
  
  ; 방법 10: 기본 설치 경로 확인
  checkDefaultDir:
    IfFileExists "$PROGRAMFILES\WorshipNote\WorshipNote.exe" 0 checkAllUsers
    StrCpy $0 "$PROGRAMFILES\WorshipNote\uninstall.exe"
    StrCpy $1 "$PROGRAMFILES\WorshipNote"
    Goto foundInstallation
  
  ; 방법 11: 모든 사용자 Program Files 확인
  checkAllUsers:
    IfFileExists "$COMMONFILES\WorshipNote\WorshipNote.exe" 0 skipUninstall
    StrCpy $0 "$COMMONFILES\WorshipNote\uninstall.exe"
    StrCpy $1 "$COMMONFILES\WorshipNote"
    Goto foundInstallation
  
  foundInstallation:
    ; 디버깅 정보 표시
    DetailPrint "기존 WorshipNote 설치 발견!"
    DetailPrint "제거 프로그램: $0"
    DetailPrint "설치 경로: $1"
    
    ; 기존 설치가 있으면 사용자에게 확인
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 "WorshipNote가 이미 설치되어 있습니다.$\n$\n설치 경로: $1$\n$\n기존 앱을 제거하고 새 버전을 설치하시겠습니까?$\n$\n• 예: 기존 앱을 제거하고 새 버전 설치$\n• 아니오: 설치를 취소합니다" IDYES doUninstall IDNO cancelInstall
  
  doUninstall:
    ; 진행 상황 표시
    DetailPrint "기존 WorshipNote를 제거하는 중..."
    
    ; 기존 앱이 실행 중이면 종료 시도
    DetailPrint "실행 중인 WorshipNote 프로세스 종료 시도..."
    ExecWait "taskkill /f /im WorshipNote.exe" $1
    Sleep 2000
    
    ; 제거 프로그램이 있으면 실행
    IfFileExists "$0" 0 manualUninstall
    DetailPrint "제거 프로그램 실행: $0"
    ExecWait '"$0" /S' $1
    Sleep 3000
    Goto checkUninstallResult
    
    ; 수동 제거 시도
    manualUninstall:
      DetailPrint "제거 프로그램이 없습니다. 수동으로 제거 시도..."
      RMDir /r "$1"
      Sleep 1000
    
    ; 제거 완료 확인
    checkUninstallResult:
      IfFileExists "$1\WorshipNote.exe" uninstallFailed uninstallSuccess
    
    uninstallSuccess:
      MessageBox MB_OK|MB_ICONINFORMATION "기존 WorshipNote가 성공적으로 제거되었습니다.$\n새 버전을 설치합니다."
      Goto skipUninstall
      
    uninstallFailed:
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "기존 WorshipNote 제거에 실패했습니다.$\n$\n수동으로 제거 후 다시 설치하시겠습니까?$\n$\n• 예: 설치를 계속 진행$\n• 아니오: 설치를 취소합니다" IDYES skipUninstall IDNO cancelInstall
  
  cancelInstall:
    MessageBox MB_OK|MB_ICONINFORMATION "설치가 취소되었습니다."
    Quit
  
  skipUninstall:
    DetailPrint "기존 WorshipNote 설치를 찾을 수 없습니다. 새로 설치합니다."
!macroend

