@echo off
chcp 65001 > nul
title 현장 작업일지 Pro 실행기

echo ========================================================
echo   ⚡ 현장 작업일지 및 정산 관리 시스템 실행 중...
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 8080; " ^
  "$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress; " ^
  "Write-Host '  [PC 브라우저 접속 주소]' -ForegroundColor Green; " ^
  "Write-Host '  http://localhost:'$port -ForegroundColor Cyan; " ^
  "Write-Host ''; " ^
  "Write-Host '  [스마트폰(모바일) 접속 주소 - 동일 와이파이 연결 시]' -ForegroundColor Yellow; " ^
  "Write-Host '  http://'$ip':'$port -ForegroundColor Magenta; " ^
  "Write-Host ''; " ^
  "Write-Host '  * 스마트폰 브라우저에서 위 주소로 접속 후 [홈 화면에 추가]를 누르면' -ForegroundColor Gray; " ^
  "Write-Host '    일반 앱처럼 단독 실행됩니다.' -ForegroundColor Gray; " ^
  "Write-Host ''; " ^
  "Write-Host '  종료하려면 창을 닫거나 Ctrl+C 를 누르세요.' -ForegroundColor DarkGray; " ^
  "Start-Process ('http://localhost:' + $port); " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add('http://*:' + $port + '/'); " ^
  "try { $listener.Start() } catch { " ^
  "  $listener = New-Object System.Net.HttpListener; " ^
  "  $listener.Prefixes.Add('http://localhost:' + $port + '/'); " ^
  "  $listener.Start(); " ^
  "} " ^
  "while ($listener.IsListening) { " ^
  "  $context = $listener.GetContext(); " ^
  "  $req = $context.Request; " ^
  "  $res = $context.Response; " ^
  "  $path = $req.Url.LocalPath.TrimStart('/'); " ^
  "  if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }; " ^
  "  $filePath = Join-Path $PWD $path; " ^
  "  if (Test-Path $filePath -PathType Leaf) { " ^
  "    $bytes = [System.IO.File]::ReadAllBytes($filePath); " ^
  "    $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); " ^
  "    $contentType = switch ($ext) { " ^
  "      '.html' { 'text/html; charset=utf-8' } " ^
  "      '.js'   { 'application/javascript; charset=utf-8' } " ^
  "      '.json' { 'application/json; charset=utf-8' } " ^
  "      '.css'  { 'text/css; charset=utf-8' } " ^
  "      '.png'  { 'image/png' } " ^
  "      Default { 'application/octet-stream' } " ^
  "    }; " ^
  "    $res.ContentType = $contentType; " ^
  "    $res.ContentLength64 = $bytes.Length; " ^
  "    $res.OutputStream.Write($bytes, 0, $bytes.Length); " ^
  "  } else { " ^
  "    $res.StatusCode = 404; " ^
  "  } " ^
  "  $res.OutputStream.Close(); " ^
  "}"
pause
