Add-Type -AssemblyName System.Drawing
$artSource = Join-Path $PSScriptRoot '../assets-source'
$artOutput = Join-Path $PSScriptRoot '../public/assets'
$artMap = @{
 '04_27_40 PM-1' = 'logo'; '04_27_41 PM-2' = 'monogram';
 '04_27_41 PM-3' = 'connection'; '04_27_42 PM-4' = 'navpreet';
 '04_27_43 PM-5' = 'care'; '04_27_43 PM-6' = 'booking';
 '04_27_44 PM-7' = 'journal'; '04_27_44 PM-8' = 'elements'
}
$artElements = [System.Drawing.Bitmap]::new((Join-Path $artSource 'ChatGPT Image Nov 10, 2026, 04_27_44 PM-8.png'))
$artLeaf = $artElements.Clone([System.Drawing.Rectangle]::new(20,320,275,385),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$artLeaf.Save((Join-Path $artOutput 'botanical.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$artLeaf.Dispose(); $artElements.Dispose()
foreach ($artKey in $artMap.Keys) {
 $artInput = Join-Path $artSource "ChatGPT Image Nov 10, 2026, $artKey.png"
 $artImage = [System.Drawing.Image]::FromFile($artInput)
 $artMax = if ($artMap[$artKey] -eq 'logo') {850} elseif ($artMap[$artKey] -eq 'monogram') {160} else {1100}
 $artRatio = [Math]::Min([double]1, [double]$artMax / [double]$artImage.Width)
 $artBitmap = New-Object System.Drawing.Bitmap([int]($artImage.Width*$artRatio),[int]($artImage.Height*$artRatio))
 $artGraphics = [System.Drawing.Graphics]::FromImage($artBitmap)
 $artGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $artGraphics.DrawImage($artImage,0,0,$artBitmap.Width,$artBitmap.Height)
 if ($artMap[$artKey] -eq 'care') { $artBitmap.Save((Join-Path $artOutput 'care.png'),[System.Drawing.Imaging.ImageFormat]::Png) }
 if ($artMap[$artKey] -in @('logo','monogram','elements')) {
  $artBitmap.Save((Join-Path $artOutput ($artMap[$artKey]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
 } else {
  $artFlat = [System.Drawing.Bitmap]::new($artBitmap.Width,$artBitmap.Height)
  $artFlatGraphics = [System.Drawing.Graphics]::FromImage($artFlat)
  $artFlatGraphics.Clear([System.Drawing.Color]::FromArgb(247,246,240))
  $artFlatGraphics.DrawImage($artBitmap,0,0)
  $artEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $artParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $artParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]88)
  $artFlat.Save((Join-Path $artOutput ($artMap[$artKey]+'.jpg')),$artEncoder,$artParameters)
  $artParameters.Dispose(); $artFlatGraphics.Dispose(); $artFlat.Dispose()
 }
 $artGraphics.Dispose(); $artBitmap.Dispose(); $artImage.Dispose()
}
