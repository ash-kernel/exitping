; =====================================================================
; ExitPing Pro - Custom NSIS Setup Script
; =====================================================================
; This script is loaded by electron-builder during compiler time.
; You can inject custom header alignments, registry entries, or 
; background routines here to elevate the user install journey.

!macro customHeader
  ; Set a modern corporate branding label inside the setup header
  BrandingText "ExitPing Pro Suite"
!macroend

!macro customInit
  ; You can add registry checks or background system cleanups here before installation
!macroend

!macro customUnInit
  ; Clean up custom app data or registry keys on uninstallation
!macroend
