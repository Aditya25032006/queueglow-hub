param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('codex', 'claude')]
  [string]$Provider
)

$ErrorActionPreference = 'Stop'

function Is-HubRunning($heartbeat) {
  if (!(Test-Path -LiteralPath $heartbeat)) { return $false }
  return (([DateTime]::UtcNow - (Get-Item -LiteralPath $heartbeat).LastWriteTimeUtc).TotalSeconds -lt 3)
}

try {
  $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if (!$payload -or $payload -isnot [pscustomobject]) { exit 0 }

  $root = if ($env:QUEUEGLOW_HOME) { $env:QUEUEGLOW_HOME } else { Join-Path $env:LOCALAPPDATA 'Queueglow' }
  $ipc = Join-Path $root 'ipc'
  $inbox = Join-Path $ipc 'inbox'
  $decisions = Join-Path $ipc 'decisions'
  $heartbeat = Join-Path $ipc 'heartbeat'
  [IO.Directory]::CreateDirectory($inbox) | Out-Null
  [IO.Directory]::CreateDirectory($decisions) | Out-Null

  $name = [string]$payload.hook_event_name
  if (!$name) { $name = [string]$payload.event }
  $kinds = @{ SessionStart = 'start'; PreToolUse = 'activity'; PostToolUse = 'activity'; PermissionRequest = 'permission'; Stop = 'done'; SessionEnd = 'done'; Notification = 'system'; Error = 'error' }
  $kind = if ($kinds.ContainsKey($name)) { $kinds[$name] } else { 'system' }
  $session = [string]$payload.session_id
  if (!$session) { $session = [string]$payload.thread_id }
  if (!$session) { $session = [string]$payload.turn_id }
  if (!$session) { $session = 'local' }
  $session = $session.Substring(0, [Math]::Min(120, $session.Length))

  $tool = [string]$payload.tool_name
  if (!$tool) { $tool = 'Agent action' }
  $description = [string]$payload.tool_input.description
  $summary = if ($kind -eq 'start') { 'Session started' }
    elseif ($kind -eq 'done') { 'Session finished' }
    elseif ($kind -eq 'error') { 'Session needs attention' }
    elseif ($kind -in @('activity', 'permission') -and $description) { $description }
    elseif ($kind -in @('activity', 'permission') -and $tool -match '^(Bash|PowerShell|exec_command)$') { 'Running a command' }
    elseif ($kind -in @('activity', 'permission')) { "Using $tool" }
    else { [string]$payload.message }
  if (!$summary) { $summary = $name }
  if (!$summary) { $summary = 'Agent event' }
  $summary = $summary.Substring(0, [Math]::Min(180, $summary.Length))
  $detail = if ($kind -eq 'permission' -and $payload.tool_input) { $payload.tool_input | ConvertTo-Json -Depth 8 } else { '' }
  $detail = $detail.Substring(0, [Math]::Min(4000, $detail.Length))

  $id = [Guid]::NewGuid().ToString()
  $event = @{
    id = $id; provider = $Provider; session_id = "${Provider}:${session}";
    kind = $kind; summary = $summary; detail = $detail;
    happened_at = [DateTime]::UtcNow.ToString('o');
    expires_at = if ($kind -eq 'permission') { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 55 } else { $null }
  }
  $temporary = Join-Path $inbox ".$id.tmp"
  $destination = Join-Path $inbox "$id.json"
  [IO.File]::WriteAllText($temporary, ($event | ConvertTo-Json -Compress -Depth 8), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $destination -Force

  if ($kind -eq 'permission' -and (Is-HubRunning $heartbeat)) {
    $decisionFile = Join-Path $decisions "$id.json"
    $deadline = [DateTime]::UtcNow.AddSeconds(55)
    while ([DateTime]::UtcNow -lt $deadline -and (Is-HubRunning $heartbeat)) {
      if (Test-Path -LiteralPath $decisionFile) {
        $decision = Get-Content -Raw -LiteralPath $decisionFile | ConvertFrom-Json
        Remove-Item -LiteralPath $decisionFile -Force
        if ($decision.id -eq $id -and $decision.behavior -in @('allow', 'deny')) {
          @{ hookSpecificOutput = @{ hookEventName = 'PermissionRequest'; decision = @{ behavior = $decision.behavior } } } | ConvertTo-Json -Compress -Depth 5
        }
        break
      }
      Start-Sleep -Milliseconds 150
    }
  }
} catch {
  [Console]::Error.WriteLine("Queueglow hook: $($_.Exception.Message)")
}
