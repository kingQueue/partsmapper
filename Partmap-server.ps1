param(
    [ValidateSet('menu', 'start', 'stop', 'restart', 'status', 'open', 'create', 'select', 'folder')]
    [string]$Action = 'menu',
    [string]$ProjectDirectory,
    [string]$ProjectName
)

$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:4173/'
$serverScript = Join-Path $PSScriptRoot 'preview.cjs'
$runtimeDirectory = Join-Path $PSScriptRoot '.partmap-runtime'

function Get-PartmapNode {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }
    $candidate = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    throw 'Node.js 18 or newer is required.'
}
function Get-PartmapFolder {
    $configFile = Join-Path $runtimeDirectory 'project-selection.json'
    if (Test-Path -LiteralPath $configFile) { return (Get-Content -LiteralPath $configFile -Raw -Encoding UTF8 | ConvertFrom-Json).directory }
    return $null
}
function Browse-PartmapFolder([string]$Description) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $Description
    $dialog.ShowNewFolderButton = $true
    try { if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { return $dialog.SelectedPath } }
    finally { $dialog.Dispose() }
    return $null
}
function Select-PartmapProject([bool]$Create) {
    $chosenDirectory = $ProjectDirectory
    $chosenName = $ProjectName
    if (-not $chosenDirectory) {
        if ($Create) {
            $parentDirectory = Browse-PartmapFolder 'Choose where to create the new Partmap project folder'
            if (-not $parentDirectory) { return }
            $chosenName = Read-Host 'New project name (also used for the folder name)'
            if ([string]::IsNullOrWhiteSpace($chosenName) -or $chosenName -in @('.', '..') -or $chosenName.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0) { throw 'Enter a valid project folder name.' }
            $chosenDirectory = Join-Path $parentDirectory $chosenName
        } else {
            $chosenDirectory = Browse-PartmapFolder 'Open a Partmap project folder containing project.json'
            if (-not $chosenDirectory) { return }
        }
    }
    $nodeExecutable = Get-PartmapNode
    $storeAction = if ($Create) { 'create' } else { 'open' }
    $storeResult = & $nodeExecutable (Join-Path $PSScriptRoot 'project-store.cjs') $storeAction $chosenDirectory $chosenName
    if ($LASTEXITCODE -ne 0) { throw ($storeResult -join [Environment]::NewLine) }
    $selectedDirectory = Get-PartmapFolder
    Write-Host ('Selected project: ' + $selectedDirectory) -ForegroundColor Green
    Write-Host 'Open/reload Partmap to load this folder. Older tabs will stop saving when the folder changes.'
}
function Get-PartmapListener {
    $connections = @(Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)
    if ($connections.Count -eq 0) { return $null }
    return $connections[0]
}

function Get-PartmapProcess {
    $listener = Get-PartmapListener
    if ($null -eq $listener) { return $null }
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($null -ne $serverProcess -and $serverProcess.Name -eq 'node.exe' -and
        $null -ne $serverProcess.CommandLine -and
        $serverProcess.CommandLine.IndexOf($serverScript, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $serverProcess
    }
    throw 'Port 4173 belongs to another process or a server started outside this launcher. It was left running. Close that server in its original terminal, then use this menu.'
}

function Show-PartmapStatus {
    $serverProcess = Get-PartmapProcess
    if ($null -eq $serverProcess) { Write-Host 'Partmap is STOPPED.' -ForegroundColor Yellow }
    else { Write-Host "Partmap is RUNNING (process $($serverProcess.ProcessId))." -ForegroundColor Green }
    Write-Host "Address: $appUrl"
    $folder = Get-PartmapFolder
    if ($folder) { Write-Host "Project folder: $folder" -ForegroundColor Cyan } else { Write-Host "No project folder selected. Choose 6 (new) or 7 (open)." -ForegroundColor Yellow }
}

function Start-PartmapServer {
    $existing = Get-PartmapProcess
    if ($null -ne $existing) { Write-Host 'Partmap is already running.' -ForegroundColor Green; return }
    if (-not (Test-Path -LiteralPath $serverScript)) { throw "Server file not found: $serverScript" }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        $installedNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
        if (-not (Test-Path -LiteralPath $installedNode)) { throw 'Node.js 18 or newer is required. Install Node.js, then reopen Partmap.cmd.' }
        $nodeExecutable = $installedNode
    } else { $nodeExecutable = $nodeCommand.Source }
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log') -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 200
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) { break }
        try {
            $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        $serverProcess.Refresh()
        if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue }
        throw "Partmap could not start. See $runtimeDirectory\server-error.log"
    }
    Write-Host "Partmap started: $appUrl" -ForegroundColor Green
    Write-Host 'You can close this menu; the server keeps running until you choose Stop.'
}

function Stop-PartmapServer {
    $serverProcess = Get-PartmapProcess
    if ($null -eq $serverProcess) { Write-Host 'Partmap is already stopped.'; return }
    # Only the Node process running this exact checkout's server is eligible.
    Stop-Process -Id $serverProcess.ProcessId
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($null -eq (Get-Process -Id $serverProcess.ProcessId -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 100
    }
    Write-Host 'Partmap stopped. Your saved project files and browser backups are intact.' -ForegroundColor Yellow
}

function Invoke-PartmapAction([string]$SelectedAction) {
    switch ($SelectedAction) {
        'start' { Start-PartmapServer }
        'stop' { Stop-PartmapServer }
        'restart' { Stop-PartmapServer; Start-PartmapServer }
        'status' { Show-PartmapStatus }
        'open' { if (-not (Get-PartmapFolder)) { throw 'Choose Create new project (6) or Open project folder (7) first.' }; Start-PartmapServer; Start-Process ($appUrl + '?project=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) }
        'create' { Select-PartmapProject $true }
        'select' { Select-PartmapProject $false }
        'folder' { $folder = Get-PartmapFolder; if (-not $folder) { throw 'No project folder selected.' }; Start-Process explorer.exe -ArgumentList ('"' + $folder + '"') }
    }
}

if ($Action -ne 'menu') {
    try { Invoke-PartmapAction $Action; exit 0 }
    catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
}

while ($true) {
    Clear-Host
    Write-Host 'PARTMAP - LOCAL SERVER' -ForegroundColor Cyan
    Write-Host '======================'
    try { Show-PartmapStatus } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow }
    Write-Host ''
    Write-Host '1. Start server and open Partmap'
    Write-Host '2. Stop server'
    Write-Host '3. Restart server'
    Write-Host '4. Open Partmap in browser'
    Write-Host '5. Refresh status'
    Write-Host '6. Create new project folder'
    Write-Host '7. Browse and open existing project folder'
    Write-Host '8. Open selected folder in Explorer'
    Write-Host '9. Test agent/MCP access and save diagnostics'
    Write-Host '0. Close this menu (leave server as it is)'
    Write-Host ''
    $selection = Read-Host 'Choose an option'
    if ($selection -eq '0') { exit 0 }
    try {
        switch ($selection) {
            '1' { Invoke-PartmapAction 'open' }
            '2' { Invoke-PartmapAction 'stop' }
            '3' { Invoke-PartmapAction 'restart' }
            '4' { Invoke-PartmapAction 'open' }
            '5' { continue }
            '6' { Invoke-PartmapAction 'create' }
            '7' { Invoke-PartmapAction 'select' }
            '8' { Invoke-PartmapAction 'folder' }
            '9' { & (Join-Path $PSScriptRoot 'Partmap-MCP-Test.ps1') }
            default { Write-Host 'Choose an option from 0 to 9.' }
        }
    } catch { Write-Host $_.Exception.Message -ForegroundColor Red }
    Read-Host 'Press Enter to return to the menu' | Out-Null
}
