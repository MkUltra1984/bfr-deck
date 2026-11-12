# Builds the release download: one self-contained BfrDeck.exe (no .NET install needed) in .\publish\.
# Usage: .\tools\publish.ps1            (from the BfrDeck folder)
# For a GitHub release use .\tools\release.ps1, which calls this and adds the update files.
$ErrorActionPreference = 'Stop'
$proj = (Resolve-Path "$PSScriptRoot\..").Path
$out = Join-Path $proj 'publish'

# Host key: a hash of everything that makes up the program itself (not wwwroot, not the version number). The in-app
# update fetches only the small web part while this key stays the same, and the whole exe when it changes.
$files = Get-ChildItem $proj -File | Where-Object { $_.Extension -in '.cs', '.xaml', '.csproj', '.manifest', '.ico' } | Sort-Object Name
$sha = [Security.Cryptography.SHA256]::Create()
$text = foreach ($f in $files) {
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    if ($f.Extension -eq '.csproj') { $bytes = [Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($bytes) -replace '<Version>[^<]*</Version>', '')) }
    $bytes = [byte[]]($bytes | Where-Object { $_ -ne 13 })   # line endings must not matter (git may rewrite them on checkout)
    $f.Name + ':' + [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
}
$hostKey = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text -join "`n"))).Replace('-', '').Substring(0, 16).ToLower()

Get-Process BfrDeck -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
dotnet publish "$proj\BfrDeck.csproj" -c Release -o $out --nologo "-p:HostKey=$hostKey"
if ($LASTEXITCODE -ne 0) { throw 'publish failed' }
Set-Content (Join-Path $out 'hostkey.txt') $hostKey -Encoding ascii -NoNewline
# wwwroot is embedded in the exe and unpacked on first start, so BfrDeck.exe alone is the download.
Get-ChildItem $out | Select-Object Name, @{ n = 'MB'; e = { [Math]::Round($_.Length / 1MB, 1) } }
Write-Host "`nRelease file: $out\BfrDeck.exe (host key $hostKey)."
