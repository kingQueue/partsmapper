$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose a local Partmap project folder or parent directory'
$dialog.ShowNewFolderButton = $true
if (Test-Path -LiteralPath $env:PARTMAP_PICK_INITIAL -PathType Container) { $dialog.SelectedPath = $env:PARTMAP_PICK_INITIAL }
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
try {
    $owner.Show()
    $accepted = $dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK
    $result = @{ directory = $(if ($accepted) { $dialog.SelectedPath } else { $null }); cancelled = -not $accepted }
    [Console]::Write(($result | ConvertTo-Json -Compress))
} finally { $dialog.Dispose(); $owner.Dispose() }
