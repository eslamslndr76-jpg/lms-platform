$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$dir = Join-Path $PSScriptRoot '..\plan\refs'
$dir = (Resolve-Path $dir).Path

Get-ChildItem -Path $dir -Filter *.docx | ForEach-Object {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
  try {
    $entry = $zip.GetEntry('word/document.xml')
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = $reader.ReadToEnd()
    $reader.Close()
  }
  finally {
    $zip.Dispose()
  }

  $text = $xml -replace '</w:p>', "`n"
  $text = $text -replace '<w:tab[^>]*/>', "`t"
  $text = $text -replace '<w:br[^>]*/>', "`n"
  $text = $text -replace '<[^>]+>', ''
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  $text = ($text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }) -join "`n"

  $out = [System.IO.Path]::ChangeExtension($_.FullName, '.md')
  Set-Content -Path $out -Value ("# " + $_.BaseName + "`n`n" + $text) -Encoding UTF8
  Write-Output ("Wrote " + $out + " (" + $text.Length + " chars)")
}
