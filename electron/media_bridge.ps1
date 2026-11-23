$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
try { Add-Type -Path (Join-Path $PSScriptRoot 'volume.cs') } catch { }
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$streamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
$radioType = [Windows.Devices.Radios.Radio, Windows.Devices.Radios, ContentType=WindowsRuntime]
$radioAccessType = [Windows.Devices.Radios.RadioAccessStatus, Windows.Devices.Radios, ContentType=WindowsRuntime]
$radioStateType = [Windows.Devices.Radios.RadioState, Windows.Devices.Radios, ContentType=WindowsRuntime]
$radioListType = $radioType.GetMethod('GetRadiosAsync').ReturnType.GenericTypeArguments[0]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod } | Select-Object -First 1
$asStream = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Await-WinRT($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}
function Get-Radios { return @(Await-WinRT ($radioType::GetRadiosAsync()) $radioListType) }
$manager = Await-WinRT ($managerType::RequestAsync()) $managerType
$lastArtworkKey = ''
$lastSystemAt = [DateTime]::MinValue
$systemStatus = $null
function Read-SystemStatus {
  $status = @{ batteryPercent = $null; charging = $null; brightnessPercent = $null; wifiConnected = $false; wifiAvailable = $false; wifiEnabled = $null; wifiSsid = $null; bluetoothAvailable = $false; bluetoothEnabled = $null; bluetoothDevice = $null }
  try {
    foreach ($radio in (Get-Radios)) {
      if ($radio.Kind.ToString() -eq 'WiFi') { $status.wifiAvailable = $true; $status.wifiEnabled = $radio.State.ToString() -eq 'On' }
      elseif ($radio.Kind.ToString() -eq 'Bluetooth') { $status.bluetoothAvailable = $true; $status.bluetoothEnabled = $radio.State.ToString() -eq 'On' }
    }
  } catch { }
  try {
    $battery = Get-CimInstance Win32_Battery -ErrorAction Stop | Select-Object -First 1
    if ($battery) { $status.batteryPercent = [int]$battery.EstimatedChargeRemaining; $status.charging = [int]$battery.BatteryStatus -in @(2,6,7,8,9) }
  } catch { }
  try {
    $brightness = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Where-Object Active | Select-Object -First 1
    if ($brightness) { $status.brightnessPercent = [int]$brightness.CurrentBrightness }
  } catch { }
  try {
    $radios = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object { $_.NetworkInterfaceType -eq [System.Net.NetworkInformation.NetworkInterfaceType]::Wireless80211 }
    if (!$status.wifiAvailable) { $status.wifiAvailable = @($radios).Count -gt 0 }
    $status.wifiConnected = @($radios | Where-Object { $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up }).Count -gt 0
  } catch { }
  if ($status.wifiConnected) {
    try {
      $netsh = & netsh.exe wlan show interfaces 2>$null | Out-String
      $match = [regex]::Match($netsh, '(?m)^\s*SSID\s*:\s*(.+?)\s*$')
      if ($match.Success) { $status.wifiSsid = $match.Groups[1].Value.Trim().Substring(0, [Math]::Min(64, $match.Groups[1].Value.Trim().Length)) }
    } catch { }
  }
  try {
    $bluetooth = @(Get-PnpDevice -Class Bluetooth -Status OK -ErrorAction Stop)
    if (!$status.bluetoothAvailable) { $status.bluetoothAvailable = @($bluetooth | Where-Object { $_.FriendlyName -match 'Bluetooth Adapter|Bluetooth Radio' }).Count -gt 0 }
    $devices = @($bluetooth | Where-Object { $_.InstanceId -match '^BTHENUM\\DEV_' -and $_.FriendlyName })
    $device = $devices | Where-Object { $_.FriendlyName -match 'Buds|Headphones|Headset|AirPods|Speaker' } | Select-Object -First 1
    if (!$device) { $device = $devices | Select-Object -First 1 }
    if ($device) { $status.bluetoothDevice = ([string]$device.FriendlyName).Substring(0, [Math]::Min(64, ([string]$device.FriendlyName).Length)) }
  } catch { }
  return $status
}
while ($null -ne ($line = [Console]::ReadLine())) {
  try {
    $request = $line | ConvertFrom-Json
    $session = $manager.GetCurrentSession()
    $result = @{ id = $request.id; ok = $true; media = $null; volume = $null; system = $null }
    if ($request.action -eq 'setVolume') {
      $level = [Math]::Max(0, [Math]::Min(100, [double]$request.seconds)) / 100
      [VolumeControl]::Write([float]$level) | Out-Null
    }
    if ($request.action -eq 'setBrightness') {
      $level = [byte][Math]::Max(0, [Math]::Min(100, [int]$request.seconds))
      $monitor = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Where-Object Active | Select-Object -First 1
      if (!$monitor) { throw 'Brightness control is unavailable on this display' }
      $null = Invoke-CimMethod -InputObject $monitor -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = $level } -ErrorAction Stop
      $lastSystemAt = [DateTime]::MinValue
    }
    if ($request.action -eq 'setRadio') {
      $target = [string]$request.target
      if ($target -notin @('wifi', 'bluetooth') -or $request.enabled -isnot [bool]) { throw 'Invalid radio request' }
      $kind = if ($target -eq 'wifi') { 'WiFi' } else { 'Bluetooth' }
      $radio = Get-Radios | Where-Object { $_.Kind.ToString() -eq $kind } | Select-Object -First 1
      if (!$radio) { throw "$target radio is unavailable" }
      $access = Await-WinRT ($radioType::RequestAccessAsync()) $radioAccessType
      if ($access.ToString() -ne 'Allowed') { throw "$target control was denied by Windows" }
      $newState = if ($request.enabled) { [Windows.Devices.Radios.RadioState]::On } else { [Windows.Devices.Radios.RadioState]::Off }
      $outcome = Await-WinRT ($radio.SetStateAsync($newState)) $radioAccessType
      if ($outcome.ToString() -ne 'Allowed') { throw "$target could not be changed: $outcome" }
      $lastSystemAt = [DateTime]::MinValue
      for ($attempt = 0; $attempt -lt 12; $attempt++) {
        $systemStatus = Read-SystemStatus
        if ($systemStatus["${target}Enabled"] -eq $request.enabled) { break }
        Start-Sleep -Milliseconds 250
      }
      if ($systemStatus["${target}Enabled"] -ne $request.enabled) { throw "$target did not reach the requested state" }
      $lastSystemAt = [DateTime]::UtcNow
    }
    if (([DateTime]::UtcNow - $lastSystemAt).TotalSeconds -ge 10) {
      $systemStatus = Read-SystemStatus
      $lastSystemAt = [DateTime]::UtcNow
    }
    $result.system = $systemStatus
    try { $result.volume = [Math]::Round([VolumeControl]::Read() * 100) } catch { }
    if ($null -ne $session) {
      $accepted = $true
      if ($request.action -eq 'playPause') { $accepted = Await-WinRT ($session.TryTogglePlayPauseAsync()) ([bool]) }
      elseif ($request.action -eq 'next') { $accepted = Await-WinRT ($session.TrySkipNextAsync()) ([bool]) }
      elseif ($request.action -eq 'previous') { $accepted = Await-WinRT ($session.TrySkipPreviousAsync()) ([bool]) }
      elseif ($request.action -eq 'seek') {
        $seconds = [Math]::Max(0, [Math]::Min(86400, [double]$request.seconds))
        $accepted = Await-WinRT ($session.TryChangePlaybackPositionAsync([long]($seconds * 10000000))) ([bool])
      }
      if (!$accepted) { throw 'This player rejected the media control' }
      if ($request.action -in @('playPause', 'next', 'previous')) {
        Start-Sleep -Milliseconds 180
        $freshSession = $manager.GetCurrentSession()
        if ($freshSession) { $session = $freshSession }
      }
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) $propertiesType
      $timeline = $session.GetTimelineProperties()
      $playback = $session.GetPlaybackInfo()
      $title = [string]$props.Title
      if ($title.Trim().Length -gt 0) {
        $artist = [string]$props.Artist
        $source = [string]$session.SourceAppUserModelId
        $result.media = @{
          title = $title.Substring(0, [Math]::Min(180, $title.Length))
          artist = $artist.Substring(0, [Math]::Min(180, $artist.Length))
          source = $source
          playing = $playback.PlaybackStatus.ToString() -eq 'Playing'
          position = [Math]::Max(0, [double]$timeline.Position.TotalSeconds)
          duration = [Math]::Max(0, [double]($timeline.EndTime - $timeline.StartTime).TotalSeconds)
        }
        $artworkKey = "$source|$title|$artist|$($props.AlbumTitle)|$($props.TrackNumber)"
        if ($artworkKey -ne $lastArtworkKey) {
          $lastArtworkKey = $artworkKey
          try {
            if ($null -ne $props.Thumbnail) {
              $rawStream = Await-WinRT ($props.Thumbnail.OpenReadAsync()) $streamType
              $managed = $asStream.Invoke($null, @($rawStream))
              $memory = New-Object System.IO.MemoryStream
              $buffer = New-Object byte[] 8192
              while (($count = $managed.Read($buffer, 0, $buffer.Length)) -gt 0) {
                if ($memory.Length + $count -gt 2000000) { throw 'Artwork exceeds 2 MB' }
                $memory.Write($buffer, 0, $count)
              }
              $bytes = $memory.ToArray()
              if ($bytes.Length -gt 8) {
                $mime = if ($bytes[0] -eq 137 -and $bytes[1] -eq 80) { 'image/png' } elseif ($bytes[0] -eq 255 -and $bytes[1] -eq 216) { 'image/jpeg' } elseif ($bytes[0] -eq 71 -and $bytes[1] -eq 73) { 'image/gif' } else { $null }
                if ($mime) { $result.media.artwork = "data:$mime;base64,$([Convert]::ToBase64String($bytes))" }
              }
              $managed.Dispose()
              $memory.Dispose()
            }
          } catch { $result.media.artwork = $null }
        }
      }
    } else { $lastArtworkKey = '' }
    [Console]::WriteLine(($result | ConvertTo-Json -Compress -Depth 4))
  } catch {
    [Console]::WriteLine((@{ id = $request.id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress))
  }
}
