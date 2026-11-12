# Builds everything a GitHub release needs into .\publish\release\:
#   BfrDeck-win-x64.zip   the download for new users (BfrDeck.exe)
#   BfrDeck-web.zip       the wwwroot folder, what the in-app update fetches while the program itself is unchanged
#   update.json           version, notes, host key, and the checksum and size of both zips (read by Updater.cs)
# Usage: .\tools\release.ps1 -Notes "What is new, one or two sentences."      (version comes from BfrDeck.csproj)
# Then upload all three files to a release tagged v<version>; the deck reads them from releases/latest/download/.
param([Parameter(Mandatory)][string]$Notes)
$ErrorActionPreference = 'Stop'
$proj = (Resolve-Path "$PSScriptRoot\..").Path
$version = ([regex]'<Version>([^<]+)</Version>').Match((Get-Content "$proj\BfrDeck.csproj" -Raw)).Groups[1].Value
if (-not $version) { throw 'no <Version> in BfrDeck.csproj' }

& "$PSScriptRoot\publish.ps1" | Out-Host
$pub = Join-Path $proj 'publish'; $rel = Join-Path $pub 'release'
$hostKey = [IO.File]::ReadAllText((Join-Path $pub 'hostkey.txt')).Trim()   # not Get-Content: its strings carry extra properties into the JSON
New-Item -ItemType Directory -Force $rel | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
$full = Join-Path $rel 'BfrDeck-win-x64.zip'; $web = Join-Path $rel 'BfrDeck-web.zip'
$z = [IO.Compression.ZipFile]::Open($full, 'Create')
[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, (Join-Path $pub 'BfrDeck.exe'), 'BfrDeck.exe', 'Optimal') | Out-Null
$z.Dispose()
[IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $proj 'wwwroot'), $web, 'Optimal', $false)

function Part($path) { [ordered]@{ asset = [IO.Path]::GetFileName($path);sha256 = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower(); size = (Get-Item $path).Length } }
$json = [ordered]@{ version = $version; notes = $Notes; host = $hostKey; web = Part $web; full = Part $full } | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $rel 'update.json'), $json, (New-Object Text.UTF8Encoding $false))

Get-ChildItem $rel | Select-Object Name, @{ n = 'MB'; e = { [Math]::Round($_.Length / 1MB, 2) } } | Out-Host
Write-Host "Release $version (host key $hostKey): upload the three files in $rel"
