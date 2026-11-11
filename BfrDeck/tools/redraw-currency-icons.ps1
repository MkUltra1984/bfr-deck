# Crops the gem / Zel / Karma icons out of a game screenshot and asks the OpenAI image-edit endpoint for a clean,
# high-resolution redraw of each. Results land in wwwroot\img\<name>.png (256 px) and design\currency-icons\ (full size).
# Needs $env:OPENAI_API_KEY in the calling shell. Paid call (three images). Nothing here touches the game.
param(
  [string]$Screenshot = "$PSScriptRoot\..\..\screenshot-docked.png",
  [string]$Model = 'gpt-image-2',
  [string]$Size = '1024x1024',
  [string]$Quality = 'medium',
  [switch]$Transparent,     # ask the model for a transparent background (gpt-image-1 family); otherwise green-screen + key out
  [string[]]$Only = @('gem', 'zel', 'karma')   # redo a subset, e.g. -Only karma
)
$ErrorActionPreference = 'Stop'
# Key: from the shell, else from the gitignored .env in the project root (OPENAI_API_KEY=...).
if (-not $env:OPENAI_API_KEY) {
  $envFile = Join-Path (Resolve-Path "$PSScriptRoot\..\..") '.env'
  if (Test-Path $envFile) { foreach ($line in Get-Content $envFile) { if ($line -match '^\s*OPENAI_API_KEY\s*=\s*(\S+)') { $env:OPENAI_API_KEY = $Matches[1] } } }
}
if (-not $env:OPENAI_API_KEY) { throw 'No OpenAI key: set $env:OPENAI_API_KEY or put OPENAI_API_KEY=... into the project .env file.' }
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

$root = Resolve-Path "$PSScriptRoot\.."
$imgDir = Join-Path $root 'wwwroot\img'; $fullDir = Join-Path (Resolve-Path "$root\..") 'design\currency-icons'; $tmp = Join-Path $env:TEMP 'bfrdeck-icons'
foreach ($d in $imgDir, $fullDir, $tmp) { New-Item -ItemType Directory -Force $d | Out-Null }

# Where the HUD icons sit in screenshot-docked.png (BlueStacks at 610 px wide). x, y, w, h.
$crops = @{ gem = @(430, 64, 36, 34); zel = @(433, 94, 34, 32); karma = @(433, 123, 34, 32) }
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Screenshot))
foreach ($k in $crops.Keys) {
  $c = $crops[$k]
  # Upscale 8x with nearest neighbour so the model sees crisp pixel edges, on a transparent canvas.
  $b = New-Object System.Drawing.Bitmap ($c[2] * 8), ($c[3] * 8), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, ($c[2] * 8), ($c[3] * 8)), (New-Object System.Drawing.Rectangle $c[0], $c[1], $c[2], $c[3]), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $b.Save("$tmp\$k-crop.png", [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
}
$src.Dispose()

$what = @{ gem = 'a rainbow-coloured faceted diamond gem'; zel = 'a round gold coin with a wavy swirl emblem'; karma = 'a round deep-blue glossy sphere that glows from the inside out, with a soft bright cyan-white light burst radiating from its centre (pure energy, no figure, no person, no symbol)' }
$http = New-Object System.Net.Http.HttpClient; $http.Timeout = [TimeSpan]::FromMinutes(5)
$http.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $env:OPENAI_API_KEY)
foreach ($k in $Only) {
  Write-Host "redrawing $k ..."
  $form = New-Object System.Net.Http.MultipartFormDataContent
  $form.Add((New-Object System.Net.Http.StringContent $Model), 'model')
  $form.Add((New-Object System.Net.Http.StringContent $Size), 'size')
  if ($Model -notlike 'dall-e*') { $form.Add((New-Object System.Net.Http.StringContent $Quality), 'quality') }
  else { $form.Add((New-Object System.Net.Http.StringContent 'b64_json'), 'response_format') }
  if ($Transparent) { $form.Add((New-Object System.Net.Http.StringContent 'transparent'), 'background') }
  # Models without transparency get a flat pure-green background that is keyed out afterwards.
  $bg = if ($Transparent) { 'fully transparent background' } else { 'a completely flat, uniform, pure bright green (#00FF00) background with no gradient, shadow or glow touching it' }
  $prompt = "This is a tiny, blurry, upscaled icon from a mobile game HUD: $($what[$k]). Redraw it as a clean, crisp, high-resolution game icon. Keep exactly the same design, silhouette, colours, highlights and shading style. Centre it, fill about 80% of the canvas, on $bg. Remove the grey panel behind it. No text, no extra objects, no frame."
  $form.Add((New-Object System.Net.Http.StringContent $prompt), 'prompt')
  $bytes = [IO.File]::ReadAllBytes("$tmp\$k-crop.png")
  $fc = New-Object System.Net.Http.ByteArrayContent (, $bytes)
  $fc.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('image/png')
  $form.Add($fc, 'image', "$k.png")
  $resp = $http.PostAsync('https://api.openai.com/v1/images/edits', $form).Result
  $body = $resp.Content.ReadAsStringAsync().Result
  if (-not $resp.IsSuccessStatusCode) { throw "OpenAI $($resp.StatusCode): $body" }
  $json = $body | ConvertFrom-Json
  $out = [Convert]::FromBase64String($json.data[0].b64_json)
  [IO.File]::WriteAllBytes("$fullDir\$k-raw.png", $out)
  $big = [System.Drawing.Bitmap]::FromFile("$fullDir\$k-raw.png")
  if (-not $Transparent) {
    # Key out the green screen: pixels close to pure green become transparent, with a soft edge.
    $keyed = New-Object System.Drawing.Bitmap $big.Width, $big.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $big.Width, $big.Height
    $sd = $big.LockBits($rect, 'ReadOnly', [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $dd = $keyed.LockBits($rect, 'WriteOnly', [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $n = $sd.Stride * $big.Height; $buf = New-Object byte[] $n
    [Runtime.InteropServices.Marshal]::Copy($sd.Scan0, $buf, 0, $n)
    for ($i = 0; $i -lt $n; $i += 4) {
      $b = $buf[$i]; $gr = $buf[$i + 1]; $r = $buf[$i + 2]
      $greenness = $gr - [Math]::Max($r, $b)          # pure green: 255; icon colours: low or negative
      if ($greenness -gt 120) { $buf[$i + 3] = 0 }
      elseif ($greenness -gt 60) { $a = [int](255 * (120 - $greenness) / 60); $buf[$i + 3] = [byte]$a; $buf[$i + 1] = [byte][Math]::Max($r, $b) }   # de-spill the fringe
    }
    [Runtime.InteropServices.Marshal]::Copy($buf, 0, $dd.Scan0, $n)
    $big.UnlockBits($sd); $keyed.UnlockBits($dd); $big.Dispose(); $big = $keyed
  }
  $big.Save("$fullDir\$k.png", [System.Drawing.Imaging.ImageFormat]::Png)
  # 256 px copy for the app.
  $small = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($small); $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($big, 0, 0, 256, 256); $g.Dispose(); $big.Dispose()
  $small.Save("$imgDir\$k.png", [System.Drawing.Imaging.ImageFormat]::Png); $small.Dispose()
  Write-Host "  saved $imgDir\$k.png and $fullDir\$k.png"
}
$http.Dispose()
Write-Host 'done'
