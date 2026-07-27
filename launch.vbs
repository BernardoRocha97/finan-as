Dim shell, port
port = 3000

Function IsServerUp()
  Dim h
  Set h = CreateObject("MSXML2.XMLHTTP")
  On Error Resume Next
  h.Open "GET", "http://localhost:" & port & "/dashboard", False
  h.setRequestHeader "Connection", "close"
  h.Send
  IsServerUp = (Err.Number = 0 And h.Status >= 200)
  On Error GoTo 0
End Function

Function RoutesOk()
  ' Verify a key API route actually works (not just the port)
  Dim h
  Set h = CreateObject("MSXML2.XMLHTTP")
  On Error Resume Next
  h.Open "GET", "http://localhost:" & port & "/api/relatorios/patrimonio", False
  h.setRequestHeader "Connection", "close"
  h.Send
  RoutesOk = (Err.Number = 0 And h.Status = 200)
  On Error GoTo 0
End Function

Dim projectDir
projectDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = projectDir

If IsServerUp() Then
  ' Server is running — check if routes are healthy
  If Not RoutesOk() Then
    ' Routes broken (stale cache) — kill and restart clean
    shell.Run "cmd /c taskkill /f /im node.exe >nul 2>&1", 0, True
    WScript.Sleep 1500
    shell.Run "cmd /c npm run dev:clean > dev.log 2>&1", 0, False
    Dim attempts : attempts = 0
    Do While Not RoutesOk() And attempts < 30
      WScript.Sleep 2000
      attempts = attempts + 1
    Loop
  End If
Else
  ' Server not running — start clean
  shell.Run "cmd /c npm run dev:clean > dev.log 2>&1", 0, False
  Dim att : att = 0
  Do While Not IsServerUp() And att < 30
    WScript.Sleep 2000
    att = att + 1
  Loop
End If

' Open browser
If IsServerUp() Then
  shell.Run "http://localhost:" & port & "/dashboard"
Else
  MsgBox "O servidor demorou demasiado a arrancar." & vbCrLf & "Tenta abrir o terminal e correr: npm run dev:clean", vbExclamation, "Finanças"
End If
