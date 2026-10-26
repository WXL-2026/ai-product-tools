# Batch 3-image horizontal join, supports JPG/JPEG/PNG, output <=500KB
param(
    [int]$MaxHeight = 800,
    [int]$MaxSizeKB = 500,
    [int]$StartQuality = 70
)

Add-Type -AssemblyName System.Drawing

$scriptRoot = $PSScriptRoot
$outputFolder = Join-Path $scriptRoot "拼接结果"
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null

$logPath = Join-Path $scriptRoot "处理日志.txt"
"===== Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" | Out-File $logPath -Encoding UTF8

# 正确查找所有图片
$imageFiles = @(Get-ChildItem -Path "$scriptRoot\*" -Include *.jpg, *.jpeg, *.png -File)

if ($imageFiles.Count -eq 0) {
    "No image files found." | Out-File $logPath -Append -Encoding UTF8
    Read-Host "No images. Press Enter to exit"
    exit
}

# 分组
$groups = $imageFiles | Group-Object { $_.BaseName -replace '[-_]\d+$' } | Where-Object { $_.Count -eq 3 }

if ($groups.Count -eq 0) {
    "No valid groups of 3 images found." | Out-File $logPath -Append -Encoding UTF8
    Read-Host "No valid groups. Press Enter to exit"
    exit
}

$total = $groups.Count
$ok = 0
$ng = 0

foreach ($g in $groups) {
    $idx = [Array]::IndexOf($groups, $g) + 1
    Write-Host "`n[$idx/$total] Processing: $($g.Name)"

    $imgs = $g.Group | Sort-Object Name
    $loaded = @()
    $loadOk = $true

    # 加载并缩放到统一高度
    foreach ($f in $imgs) {
        try {
            $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
            if ($bmp -eq $null) { throw "Bitmap is null" }
            $newW = [int]($bmp.Width * $MaxHeight / $bmp.Height)
            if ($newW -le 0) { $newW = 1 }
            $resized = New-Object System.Drawing.Bitmap $newW, $MaxHeight
            $gfx = [System.Drawing.Graphics]::FromImage($resized)
            $gfx.Clear([System.Drawing.Color]::White)
            $gfx.DrawImage($bmp, 0, 0, $newW, $MaxHeight)
            $gfx.Dispose()
            $bmp.Dispose()
            $loaded += $resized
        }
        catch {
            "Load failed: $($f.Name) - $_" | Out-File $logPath -Append -Encoding UTF8
            $loadOk = $false
            break
        }
    }

    if (-not $loadOk -or $loaded.Count -ne 3) {
        $ng++
        foreach ($b in $loaded) { $b.Dispose() }
        continue
    }

    # 计算总宽度
    $totalW = 0
    foreach ($b in $loaded) {
        $totalW += $b.Width
    }
    if ($totalW -le 0) {
        "Invalid width for $($g.Name)" | Out-File $logPath -Append -Encoding UTF8
        $ng++
        foreach ($b in $loaded) { $b.Dispose() }
        continue
    }

    # 创建拼接画布
    try {
        $outBmp = New-Object System.Drawing.Bitmap $totalW, $MaxHeight
        $gOut = [System.Drawing.Graphics]::FromImage($outBmp)
        $gOut.Clear([System.Drawing.Color]::White)

        $x = 0
        foreach ($b in $loaded) {
            $gOut.DrawImage($b, $x, 0)
            $x += $b.Width
            $b.Dispose()
        }
    }
    catch {
        "Canvas error: $($g.Name) - $_" | Out-File $logPath -Append -Encoding UTF8
        $ng++
        if ($gOut) { $gOut.Dispose() }
        if ($outBmp) { $outBmp.Dispose() }
        foreach ($b in $loaded) { $b.Dispose() }
        continue
    }

    # 保存并控制大小
    $outFile = Join-Path $outputFolder ($g.Name + "_joined.jpg")
    $saved = $false
    $quality = $StartQuality

    while ($quality -ge 10) {
        try {
            $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $jpgEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
            $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)
            $outBmp.Save($outFile, $jpgEnc, $encParams)
            $encParams.Dispose()

            $fileKB = [math]::Round((Get-Item $outFile).Length / 1KB)
            if ($fileKB -le $MaxSizeKB) {
                "OK: $($g.Name) (${fileKB}KB, q=$quality)" | Out-File $logPath -Append -Encoding UTF8
                $ok++
                $saved = $true
                break
            }
            else {
                $quality -= 10
            }
        }
        catch {
            "Save error: $($g.Name) - $_" | Out-File $logPath -Append -Encoding UTF8
            $ng++
            break
        }
    }

    if (-not $saved) {
        "Size exceeded: $($g.Name)" | Out-File $logPath -Append -Encoding UTF8
        $ng++
    }

    $gOut.Dispose()
    $outBmp.Dispose()
}

"`nDone! Total: $total, Success: $ok, Failed: $ng" | Out-File $logPath -Append -Encoding UTF8
"Output: $outputFolder" | Out-File $logPath -Append -Encoding UTF8
"===== Ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" | Out-File $logPath -Append -Encoding UTF8

Write-Host "`nAll done. Success: $ok  Failed: $ng"
Write-Host "Output: $outputFolder"
Read-Host "Press Enter to close"