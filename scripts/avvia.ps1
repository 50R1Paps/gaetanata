# Avvia Gaetanata su Windows. Se manca un Node adatto, ne scarica uno
# portabile in .runtime\ (nessuna installazione di sistema, nessun permesso di amministratore).
param([switch]$Hidden, [switch]$ResumeUpdate)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nodeMajor = (Get-Content (Join-Path $root '.nvmrc') -Raw).Trim()
$runtimeDir = Join-Path $root '.runtime\node'
$runtimeNode = Join-Path $runtimeDir 'node.exe'

function Test-Node([string]$node) {
  $version = & $node -p 'process.versions.node' 2>$null
  return ($LASTEXITCODE -eq 0 -and [version]$version -ge $minimum)
}

function Get-PortableNode {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $base = "https://nodejs.org/dist/latest-v$nodeMajor.x"
  Write-Host "Scarico Node $nodeMajor per win-$arch (solo la prima volta)..."
  $sums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content -split "`n"
  $line = $sums | Where-Object { $_ -match " (node-v[0-9.]+-win-$arch\.zip)$" } | Select-Object -First 1
  if (-not $line) { throw "Nessuna versione di Node trovata per win-$arch" }
  $expected, $file = $line.Trim() -split '\s+'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid())
  New-Item -ItemType Directory $tmp | Out-Null
  try {
    $zip = Join-Path $tmp $file
    Invoke-WebRequest -UseBasicParsing "$base/$file" -OutFile $zip
    $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) { throw 'Checksum di Node non valido: download corrotto, riprova.' }
    Expand-Archive $zip -DestinationPath $tmp
    $oldRuntime = "$runtimeDir.previous"
    if (Test-Path $oldRuntime) { Remove-Item -Recurse -Force $oldRuntime }
    New-Item -ItemType Directory (Split-Path $runtimeDir) -Force | Out-Null
    if (Test-Path $runtimeDir) { Move-Item $runtimeDir $oldRuntime }
    try {
      Move-Item (Join-Path $tmp ($file -replace '\.zip$', '')) $runtimeDir
    } catch {
      if (Test-Path $oldRuntime) { Move-Item $oldRuntime $runtimeDir }
      throw
    }
    if (Test-Path $oldRuntime) { Remove-Item -Recurse -Force $oldRuntime }
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

function Open-Setup {
  Start-Process cmd.exe -ArgumentList "/c `"`"$root\avvia.cmd`"`""
}

try {
$requirement = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).engines.node
if ($requirement -notmatch '^>=(\d+)\.(\d+)\.(\d+)$') {
  throw 'engines.node deve essere nel formato >=X.Y.Z'
}
$minimum = [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath('Desktop')
  $programs = [Environment]::GetFolderPath('Programs')
  foreach ($folder in @($desktop, $programs)) {
    New-Item -ItemType Directory -Force $folder | Out-Null
    $shortcut = $shell.CreateShortcut((Join-Path $folder 'Gaetanata.lnk'))
    $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $shortcut.Arguments = "`"$root\scripts\avvia.vbs`""
    $shortcut.WorkingDirectory = $root
    $shortcut.IconLocation = "$root\assets\gaetanata.ico,0"
    $shortcut.Description = 'Gaetanata'
    $shortcut.Save()
  }

$systemNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $env:GAETANATA_FORCE_RUNTIME -and $systemNode -and (Test-Node $systemNode.Source)) {
  $node = $systemNode.Source
} else {
  if (-not ((Test-Path $runtimeNode) -and (Test-Node $runtimeNode))) {
    if ($Hidden) { Open-Setup; exit 0 }
    Get-PortableNode
    if (-not (Test-Node $runtimeNode)) { throw 'Il Node portabile non soddisfa engines.node.' }
  }
  $node = $runtimeNode
}

if ($Hidden) {
  $dataDir = if ($env:GAETANATA_DATA_DIR) { $env:GAETANATA_DATA_DIR } else { Join-Path $root 'data' }
  New-Item -ItemType Directory -Force $dataDir | Out-Null
  $log = Join-Path $dataDir 'avvio.log'
  & $node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts --check-setup *> $log
  if ($LASTEXITCODE -eq 10) { Open-Setup; exit 0 }
  if ($LASTEXITCODE -ne 0) {
    $reason = Get-Content $log | Where-Object { $_ -match 'Error:|Errore|fallito|EADDRINUSE' } | Select-Object -Last 1
    if (-not $reason) { $reason = Get-Content $log | Where-Object { $_.Trim() } | Select-Object -Last 1 }
    throw "Controllo di avvio fallito: $reason"
  }
  # Native stderr is diagnostic text, not a PowerShell terminating error.
  $ErrorActionPreference = 'Continue'
  & $node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts *> $log
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($code -ne 0) {
    $reason = Get-Content $log | Where-Object { $_ -match 'Error:|Errore|fallito|EADDRINUSE' } | Select-Object -Last 1
    if (-not $reason) { $reason = Get-Content $log | Where-Object { $_.Trim() } | Select-Object -Last 1 }
    throw "Avvio fallito (codice $code): $reason"
  }
} else {
  $arguments = @('--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'scripts/start.ts')
  if ($ResumeUpdate) { $arguments += '--resume-update' }
  & $node @arguments
  exit $LASTEXITCODE
}
} catch {
  if ($ResumeUpdate -and $env:GAETANATA_PREVIOUS_NODE -and (Test-Path $env:GAETANATA_PREVIOUS_NODE)) {
    $ErrorActionPreference = 'Continue'
    & $env:GAETANATA_PREVIOUS_NODE --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts --rollback-update
    exit $LASTEXITCODE
  }
  if (-not $Hidden) { throw }
  $dataDir = if ($env:GAETANATA_DATA_DIR) { $env:GAETANATA_DATA_DIR } else { Join-Path $root 'data' }
  New-Item -ItemType Directory -Force $dataDir | Out-Null
  $log = Join-Path $dataDir 'avvio.log'
  $reason = ($_.Exception.Message -split '\r?\n')[0]
  $_ | Out-String | Add-Content $log
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup("Gaetanata non si avvia.`n$reason`nLog: $log", 0, 'Gaetanata', 16)
  exit 1
}
