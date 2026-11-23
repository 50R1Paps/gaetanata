$ErrorActionPreference = 'Stop'
$env:GAETANATA_DATA_DIR = Join-Path $env:RUNNER_TEMP 'gaetanata-data'
$env:PORT = '5174'
$base = "http://127.0.0.1:$env:PORT"
$stdout = Join-Path $env:RUNNER_TEMP 'launcher-out.log'
$stderr = Join-Path $env:RUNNER_TEMP 'launcher-err.log'

function Test-Launch($process) {
  try {
    $healthy = $false
    for ($i = 0; $i -lt 120; $i++) {
      try {
        $response = Invoke-RestMethod "$base/api/health" -TimeoutSec 2
        if ($response.app -eq 'gaetanata') { $healthy = $true; break }
      } catch {}
      if ($process.HasExited) { throw 'Launcher exited before becoming healthy' }
      Start-Sleep -Seconds 2
    }
    if (-not $healthy) { throw 'Launcher did not become healthy within four minutes' }
    $page = Invoke-WebRequest "$base/" -TimeoutSec 10
    if ($page.Content -notmatch '(?i)<html') { throw 'Root did not return HTML' }
    $window = @{ windowId = 'launcher-ci-synthetic' } | ConvertTo-Json
    $registered = Invoke-RestMethod "$base/api/window" -Method Post -ContentType 'application/json' -Body $window
    if (-not $registered.active) { throw 'Synthetic window did not become active' }
    Invoke-RestMethod "$base/api/window/close" -Method Post -ContentType 'application/json' -Body $window
    if (-not $process.WaitForExit(25000)) { throw 'Launcher did not exit after last window closed' }
    if ($process.ExitCode -ne 0) { throw "Launcher exited with $($process.ExitCode)" }
    $stillRunning = $false
    try { $null = Invoke-RestMethod "$base/api/health" -TimeoutSec 2; $stillRunning = $true } catch {}
    if ($stillRunning) { throw 'Server survived launcher exit' }
  } finally {
    if (-not $process.HasExited) {
      if ($IsWindows) { & taskkill /PID $process.Id /T /F } else { Stop-Process -Id $process.Id -Force }
    }
    Get-Content $stdout -ErrorAction SilentlyContinue
    Get-Content $stderr -ErrorAction SilentlyContinue
    Get-Content (Join-Path $env:GAETANATA_DATA_DIR 'avvio.log') -ErrorAction SilentlyContinue
  }
}

if ($IsWindows) {
  $process = Start-Process cmd.exe -ArgumentList '/c', 'avvia.cmd' -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
} else {
  $process = Start-Process bash -ArgumentList './avvia.sh' -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
Test-Launch $process

if ($IsWindows) {
  $desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Gaetanata.lnk'
  $start = Join-Path ([Environment]::GetFolderPath('Programs')) 'Gaetanata.lnk'
  foreach ($path in @($desktop, $start)) {
    if (-not (Test-Path $path)) { throw "Missing shortcut: $path" }
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
    if ($shortcut.IconLocation -notlike '*gaetanata.ico*') { throw 'Missing shortcut icon' }
    $process = Start-Process $path -PassThru
    Test-Launch $process
  }
} elseif ($IsMacOS) {
  $bundle = Join-Path $HOME 'Applications/Gaetanata.app'
  & plutil -lint "$bundle/Contents/Info.plist"
  if ($LASTEXITCODE -ne 0) { throw 'Invalid bundle plist' }
  foreach ($part in @('MacOS/Gaetanata', 'Resources/gaetanata.icns')) {
    if (-not (Test-Path "$bundle/Contents/$part")) { throw "Missing bundle file: $part" }
  }
  $process = Start-Process /usr/bin/open -ArgumentList '-W', $bundle -PassThru
  Test-Launch $process
}
