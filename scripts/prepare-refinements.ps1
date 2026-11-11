Add-Type -AssemblyName System.Drawing
$outputRoot = Join-Path $PSScriptRoot '../public/assets'
$inputRoot = Join-Path $PSScriptRoot '../assets-source/pack2'
$artFiles = @{
 '06_37_31 PM-1'='quiet-room'; '06_37_32 PM-2'='soft-landscape';
 '06_37_32 PM-3'='morning-landscape'; '06_37_34 PM-4'='portrait-illustration';
 '06_37_35 PM-5'='standing-illustration'; '06_37_35 PM-6'='one-to-one';
 '06_37_35 PM-7'='family-circle'; '06_37_36 PM-10'='journal-writing'
}
function Save-WebsitePhoto($inputPath,$outputName,$maxWidth) {
 $sourceImage = [System.Drawing.Image]::FromFile($inputPath)
 $ratio = [Math]::Min([double]1,[double]$maxWidth/[double]$sourceImage.Width)
 $bitmap = [System.Drawing.Bitmap]::new([int]($sourceImage.Width*$ratio),[int]($sourceImage.Height*$ratio))
 $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.Clear([System.Drawing.Color]::FromArgb(247,246,240))
 $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $graphics.DrawImage($sourceImage,0,0,$bitmap.Width,$bitmap.Height)
 $encoder=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
 $parameters=[System.Drawing.Imaging.EncoderParameters]::new(1)
 $parameters.Param[0]=[System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]90)
 $bitmap.Save((Join-Path $outputRoot ($outputName+'.jpg')),$encoder,$parameters)
 $parameters.Dispose();$graphics.Dispose();$bitmap.Dispose();$sourceImage.Dispose()
}
foreach($item in $artFiles.Keys){Save-WebsitePhoto (Join-Path $inputRoot "ChatGPT Image Nov 10, 2026, $item.png") $artFiles[$item] 1000}
Save-WebsitePhoto 'C:/Users/Gaming PC/.codex/generated_images/01a1c7ad-bc71-7cf2-8d89-abe875fa3ce9/exec-7fc16a3b-1beb-496b-8460-39f151289cac.png' 'navpreet-photo-v1' 900
$iconSheet=[System.Drawing.Bitmap]::new((Join-Path $inputRoot 'ChatGPT Image Nov 10, 2026, 06_37_36 PM-8.png'))
foreach($iconSpec in @(@('person',40,50,330,330),@('lotus',365,50,330,330),@('calendar',710,50,330,330),@('heart',370,730,330,330))){
 $icon=$iconSheet.Clone([System.Drawing.Rectangle]::new([int]$iconSpec[1],[int]$iconSpec[2],[int]$iconSpec[3],[int]$iconSpec[4]),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $icon.Save((Join-Path $outputRoot ('icon-'+$iconSpec[0]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png);$icon.Dispose()
}
$iconSheet.Dispose()
