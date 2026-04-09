# Starts Brave with Chrome DevTools Protocol enabled so npm run dev:ext can reload the extension.
# Usage: right-click -> Run with PowerShell, or: pwsh -File scripts/start-brave-debug.ps1

$ErrorActionPreference = "Stop"

$candidates = @(
    "${env:ProgramFiles}\BraveSoftware\Brave-Browser\Application\brave.exe",
    "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe"
)

$exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exe) {
    Write-Host "Could not find brave.exe. Edit scripts/start-brave-debug.ps1 and set the path manually."
    exit 1
}

$port = if ($env:CDP_PORT) { $env:CDP_PORT } else { "9222" }
Write-Host "Starting Brave with --remote-debugging-port=$port"
Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$port"
