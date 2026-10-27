# Generate app icon, adaptive icon, splash & favicon from assets/logo.png
# Usage (from mobile folder):  powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
$src    = Join-Path $assets 'logo.png'

if (-not (Test-Path $src)) {
  Write-Error "File tidak ditemukan: $src  -- simpan logo kamu sebagai assets/logo.png"
  exit 1
}

$logo = [System.Drawing.Image]::FromFile($src)

function New-Canvas {
  param(
    [int]$Size,
    [double]$Scale,          # porsi kanvas yang dipakai logo (0..1)
    [string]$OutFile,
    [System.Drawing.Color]$Bg
  )
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'HighQuality'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode   = 'HighQuality'
  $g.Clear($Bg)

  $box   = $Size * $Scale
  $ratio = [Math]::Min($box / $logo.Width, $box / $logo.Height)
  $w = [int]($logo.Width * $ratio)
  $h = [int]($logo.Height * $ratio)
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)
  $g.DrawImage($logo, $x, $y, $w, $h)

  $bmp.Save((Join-Path $assets $OutFile), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "OK  $OutFile ($Size x $Size)"
}

$white       = [System.Drawing.Color]::White
$transparent = [System.Drawing.Color]::Transparent

# iOS / umum: wajib tanpa transparansi
New-Canvas -Size 1024 -Scale 0.90 -OutFile 'icon.png'                    -Bg $white
# Android adaptive: logo harus di dalam safe zone (~66%)
New-Canvas -Size 1024 -Scale 0.66 -OutFile 'android-icon-foreground.png' -Bg $transparent
# Splash screen
New-Canvas -Size 1024 -Scale 1.00 -OutFile 'splash-icon.png'             -Bg $transparent
# Web favicon
New-Canvas -Size 48   -Scale 1.00 -OutFile 'favicon.png'                 -Bg $transparent

$logo.Dispose()
Write-Host "`nSelesai! Jalankan ulang: npx expo start --clear"
