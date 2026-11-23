Option Explicit
Dim shell, fs, root, command
Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
root = fs.GetParentFolderName(fs.GetParentFolderName(WScript.ScriptFullName))
' WScript is a GUI host; Run style 0 hides PowerShell before creation (no flash).
shell.Environment("Process")("PSModulePath") = ""
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & root & "\scripts\avvia.ps1"" -Hidden"
WScript.Quit shell.Run(command, 0, True)
