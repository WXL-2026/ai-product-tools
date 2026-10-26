@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

if not exist "output" mkdir output

for %%i in (*.jpg *.jpeg *.png *.bmp *.tif) do (
    echo 正在处理: %%i
    magick "%%i" -crop 3x1@ +repage "output\%%~ni_part%%d.jpg"
)

echo 完成！
pause