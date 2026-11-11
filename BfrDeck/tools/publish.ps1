# Builds the release download: one self-contained BfrDeck.exe (no .NET install needed) in .\publish\.
# Usage: .\tools\publish.ps1            (from the BfrDeck folder)
$ErrorActionPreference = 'Stop'
$proj = Resolve-Path "$PSScriptRoot\.."
$out = Join-Path $proj 'publish'
Get-Process BfrDeck -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
dotnet publish "$proj\BfrDeck.csproj" -c Release -o $out --nologo
if ($LASTEXITCODE -ne 0) { throw 'publish failed' }
# wwwroot is embedded in the exe and unpacked on first start, so BfrDeck.exe alone is the download.
Get-ChildItem $out | Select-Object Name, @{ n = 'MB'; e = { [Math]::Round($_.Length / 1MB, 1) } }
Write-Host "`nRelease file: $out\BfrDeck.exe. Zip it as BfrDeck-win-x64.zip for GitHub Releases."
