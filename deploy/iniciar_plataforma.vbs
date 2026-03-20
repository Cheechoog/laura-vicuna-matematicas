Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptFolder = FSO.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptFolder & "\run.bat"

WshShell.Run Chr(34) & batPath & Chr(34), 1, False