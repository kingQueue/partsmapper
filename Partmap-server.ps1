param(
    [ValidateSet('menu', 'start', 'stop', 'restart', 'status', 'open')]
    [string]$Action = 'menu'
)

$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:4173/'
$serverScript = Join-Path $PSScriptRoot 'preview.cjs'
$runtimeDirectory = Join-Path $PSScriptRoot '.partmap-runtime'

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
    Write-Host 'Partmap stopped. Your browser-saved projects have not been deleted.' -ForegroundColor Yellow
}

function Invoke-PartmapAction([string]$SelectedAction) {
    switch ($SelectedAction) {
        'start' { Start-PartmapServer }
        'stop' { Stop-PartmapServer }
        'restart' { Stop-PartmapServer; Start-PartmapServer }
        'status' { Show-PartmapStatus }
        'open' { Start-PartmapServer; Start-Process $appUrl }
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
            default { Write-Host 'Choose 0, 1, 2, 3, 4, or 5.' }
        }
    } catch { Write-Host $_.Exception.Message -ForegroundColor Red }
    Read-Host 'Press Enter to return to the menu' | Out-Null
}
