param([string]$ProjectDirectory)
$ErrorActionPreference = 'Stop'
if (-not $ProjectDirectory) {
    $selectionFile = Join-Path $PSScriptRoot '.partmap-runtime\project-selection.json'
    if (-not (Test-Path -LiteralPath $selectionFile)) { throw 'Choose a project folder in Partmap Server first.' }
    $ProjectDirectory = (Get-Content -LiteralPath $selectionFile -Raw -Encoding UTF8 | ConvertFrom-Json).directory
}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$clientFile = Join-Path $PSScriptRoot 'mcp\client.mjs'
$previousOutputEncoding = [Console]::OutputEncoding
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $output = & $nodeExecutable $clientFile --project $ProjectDirectory --allow-writes --self-test
$testExit = $LASTEXITCODE
} finally { [Console]::OutputEncoding = $previousOutputEncoding }
$runtimeDirectory = Join-Path $PSScriptRoot '.partmap-runtime\mcp'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$reportFile = Join-Path $runtimeDirectory 'last-access-test.json'
$output | Set-Content -LiteralPath $reportFile -Encoding UTF8
$report = ($output -join [Environment]::NewLine) | ConvertFrom-Json
if ($testExit -ne 0 -or -not $report.ok) {
    Write-Host 'MCP ACCESS TEST FAILED' -ForegroundColor Red
    Write-Host "Send this access-test file: $reportFile"
    if ($report.diagnostics.savedPath) { Write-Host ('Shareable diagnostic report: ' + $report.diagnostics.savedPath) }
    Write-Host ($report | ConvertTo-Json -Depth 8)
    return
}
Write-Host 'MCP ACCESS TEST PASSED' -ForegroundColor Green
Write-Host "Project: $ProjectDirectory"
Write-Host 'Connection, tool discovery, project validation, proof-file write/read-back, and error logging passed.'
Write-Host 'The hardware project was not changed.'
Write-Host ('Shareable diagnostic report: ' + $report.diagnostics.savedPath)
Write-Host "Full access-test report: $reportFile"
