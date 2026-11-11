# Builds app.ico (the exe / window icon) from a unit thumbnail: Phaedra (851018) by default.
# The thumbnail comes from the deck's own disk cache (fetched when the unit was shown) or from the CDN.
param([int]$Unit = 851018)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$proj = Resolve-Path "$PSScriptRoot\.."
$url = "https://cdn.bfrevive.net/content/unit/img/unit_ills_thum_$Unit.png"
$key = ([BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($url))) -replace '-', '').Substring(0, 24)
$cached = Join-Path $env:LOCALAPPDATA "BfrDeck\cache\$key.bin"
if (Test-Path $cached) { $png = [IO.File]::ReadAllBytes($cached); Write-Host "thumbnail from cache ($($png.Length) bytes)" }
else { $png = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content; Write-Host "thumbnail from CDN ($($png.Length) bytes)" }
$src = [System.Drawing.Bitmap]::FromStream((New-Object IO.MemoryStream (, $png)))
Write-Host "source $($src.Width)x$($src.Height)"
# Round the corners a little so it reads as an app icon, then write one PNG per size into an ICO container.
$sizes = 256, 64, 48, 32, 16
$entries = @()
foreach ($s in $sizes) {
  $b = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $r = [Math]::Max(2, [int]($s * 0.14)); $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90); $path.AddArc($s - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90); $path.AddArc($s - 2 * $r, $s - 2 * $r, 2 * $r, 2 * $r, 0, 90); $path.AddArc(0, $s - 2 * $r, 2 * $r, 2 * $r, 90, 90); $path.CloseFigure()
  $g.SetClip($path)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $s, $s), (New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $ms = New-Object IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  $entries += , @{ size = $s; data = $ms.ToArray() }
}
$src.Dispose()
$out = Join-Path $proj 'app.ico'
$fs = [IO.File]::Create($out); $w = New-Object IO.BinaryWriter $fs
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$entries.Count)
$offset = 6 + 16 * $entries.Count
foreach ($e in $entries) {
  $dim = if ($e.size -ge 256) { 0 } else { $e.size }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0); $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$e.data.Length); $w.Write([uint32]$offset)
  $offset += $e.data.Length
}
foreach ($e in $entries) { $w.Write($e.data) }
$w.Dispose(); $fs.Dispose()
Write-Host "wrote $out ($((Get-Item $out).Length) bytes, sizes $($sizes -join '/'))"
# Preview for a quick look
$pv = New-Object System.Drawing.Bitmap 420, 140; $g = [System.Drawing.Graphics]::FromImage($pv); $g.Clear([System.Drawing.Color]::FromArgb(29, 31, 37)); $x = 10
foreach ($e in $entries) { $img = [System.Drawing.Image]::FromStream((New-Object IO.MemoryStream (, $e.data))); $d = [Math]::Min(120, $e.size); $g.DrawImage($img, $x, 10 + (120 - $d) / 2, $d, $d); $x += $d + 10 }
$g.Dispose(); $pv.Save((Join-Path $env:TEMP 'bfrdeck-icon-preview.png')); $pv.Dispose()
Write-Host "preview: $env:TEMP\bfrdeck-icon-preview.png"
