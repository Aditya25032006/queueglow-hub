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

function Limit-Text([string]$value, [int]$limit) {
  if ($value.Length -le $limit) { return $value }
  $end = $limit - 3
  if ([char]::IsHighSurrogate($value[$end - 1])) { $end-- }
  return $value.Substring(0, $end) + '...'
}

function Protect-Text($value, [int]$limit) {
  if ($value -isnot [string]) { return '' }
  $sample = Limit-Text $value 16000
  $sample = $sample -replace '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', ''
  $sample = $sample -replace '(?is)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?(?:-----END [A-Z ]*PRIVATE KEY-----|\z)', '[redacted private key]'
  $sample = $sample -replace '(?im)(\b(?:proxy-)?authorization["'']?[ \t]*:[ \t]*)[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*', '$1[redacted]'
  $sample = $sample -replace '(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+', 'Bearer [redacted]'
  $sample = $sample -replace '(?i)\b(?:sk-(?:proj-|ant-api\d+-)?[\w-]{12,}|gh[pousr]_[\w]{12,}|github_pat_[\w]{12,}|xox[baprs]-[\w-]{12,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b', '[redacted]'
  $sample = $sample -replace '(?i)(\b[a-z][a-z0-9+.-]*://)[^/\s@]+@', '$1[redacted]@'
  $secretAssignment = '(?i)(\b[\w.-]*(?:api[-_]?key|access[-_]?key|token|secret|password|passwd|authorization|credential)[\w.-]*["'']?(?:\s*[:=]\s*|(?<=-[\w-]+)\s+))(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s;&,]+)'
  $sample = $sample -replace $secretAssignment, '$1[redacted]'
  foreach ($privatePath in @($env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA)) {
    if ([string]::IsNullOrWhiteSpace($privatePath)) { continue }
    $sample = $sample -replace [regex]::Escape($privatePath), '~'
    $sample = $sample -replace [regex]::Escape($privatePath.Replace('\', '/')), '~'
  }
  return (Limit-Text $sample.Trim() $limit)
}

function Get-DisplayPath($value, $workingDirectory) {
  if ($value -isnot [string] -or !$value.Trim()) { return '' }
  $file = $value.Replace('\', '/')
  $cwd = ([string]$workingDirectory).Replace('\', '/').TrimEnd('/')
  if ($cwd -and $file.StartsWith("$cwd/", [StringComparison]::OrdinalIgnoreCase)) {
    $file = $file.Substring($cwd.Length + 1)
  } elseif ($file -match '^(?:[A-Za-z]:|/|~/|\.\./)') {
    $file = ($file.TrimEnd('/') -split '/')[-1]
  }
  return (Protect-Text $file 140)
}

function Get-CommandLabel($command) {
  if ($command -isnot [string]) { return '' }
  $preview = (Limit-Text $command.Trim() 1000) -replace '^(?i)(?:"[^"]*(?:powershell|pwsh|bash|sh)(?:\.exe)?"|\S*(?:powershell|pwsh|bash|sh)(?:\.exe)?)\s+(?:-[\w-]+\s+)*?(?:-command|-lc|-c)\s*["'']?', ''
  $testRunner = '(?i)^(?<runner>(?:npm|pnpm|yarn|bun)(?:\.cmd)?\s+(?:(?:run|exec|x)\s+)?(?:test(?::[\w-]+)?|vitest|jest|playwright\s+test)|npx(?:\.cmd)?\s+(?:vitest|jest|playwright\s+test)|node(?:\.exe)?\s+--test|pytest|python(?:3|\.exe)?\s+-m\s+(?:pytest|unittest)|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle(?:w)?\s+test|Invoke-Pester)(?=\s|[;&|"'']|$)'
  if ($preview -match $testRunner) {
    return @{ name = ($Matches.runner -replace '\s+', ' '); tests = $true }
  }
  if ($preview -match '^(?i)(?<verb>git\s+(?:status|diff|log|show|add|commit|fetch|pull|push|branch|switch|checkout))\b') {
    return @{ name = ($Matches.verb -replace '\s+', ' '); tests = $false }
  }
  if ($preview -match '^(?:"(?<program>[^"]+)"|''(?<program>[^'']+)''|(?<program>[^\s;&|]+))') {
    $program = ($Matches.program -split '[/\\]')[-1]
    if ($program -match '^[A-Za-z0-9_.-]{1,64}$') {
      return @{ name = (Protect-Text $program 64); tests = $false }
    }
  }
  return $null
}

function Get-ToolActivity($payload, [string]$name) {
  $tool = Protect-Text $payload.tool_name 80
  if (!$tool) { $tool = 'Agent action' }
  $toolInput = $payload.tool_input
  $description = Protect-Text $toolInput.description 150
  $ending = $name -in @('PostToolUse', 'PostToolUseFailure')
  $failed = $name -eq 'PostToolUseFailure'
  $summary = ''
  $detail = ''
  if ($tool -match '^(Bash|PowerShell|exec_command)$') {
    $label = Get-CommandLabel $toolInput.command
    $subject = if ($label.tests) { 'tests' } else { 'command' }
    if ($failed) {
      $status = if ($payload.is_interrupt -eq $true) { 'interrupted' } else { 'failed' }
      if ($payload.error -is [string] -and $payload.error -match '\AExit code (-?\d{1,10})\b') {
        $status += " (exit $($Matches[1]))"
      }
      $summary = "$subject $status"
      $summary = $summary.Substring(0, 1).ToUpperInvariant() + $summary.Substring(1)
      if ($label.name) { $summary += " - $($label.name)" }
    } elseif ($ending) {
      if ($payload.tool_response.interrupted -eq $true) {
        $summary = "Interrupted $subject"
      } else {
        $summary = "Finished $subject"
      }
      if ($label.name) { $summary += " - $($label.name)" }
    } elseif ($label.name) {
      $summary = "Running $subject - $($label.name)"
    }
    if ($name -eq 'PermissionRequest' -and $toolInput.command -is [string]) {
      $preview = Protect-Text $toolInput.command 4000
      if ($preview -ceq $toolInput.command.Trim()) { $detail = $preview }
    }
  } elseif ($tool -eq 'apply_patch') {
    $files = if ($toolInput.command -is [string]) {
      [regex]::Matches($toolInput.command, '(?m)^\*\*\* (?:Add File|Update File|Delete File|Move to): ([^\r\n]+)') |
        Select-Object -First 4 |
        ForEach-Object { Get-DisplayPath $_.Groups[1].Value $payload.cwd }
    }
    $summary = if ($ending) { 'Applied patch' } else { 'Applying patch' }
    if ($files) { $summary += ' - ' + (($files | Select-Object -First 3) -join ', ') }
    if (@($files).Count -gt 3) { $summary += ', ...' }
  } else {
    $file = Get-DisplayPath $toolInput.file_path $payload.cwd
    if (!$file -and $tool -eq 'NotebookEdit') {
      $file = Get-DisplayPath $toolInput.notebook_path $payload.cwd
    }
    if ($file) {
      $summary = if ($failed) { "$tool failed - $file" } elseif ($ending) { "Finished $tool - $file" } else { "$tool - $file" }
    }
  }
  if ($name -eq 'PermissionRequest' -and $description) { $summary = $description }
  if (!$summary) {
    $summary = if ($description) { $description } elseif ($failed) { "$tool failed" } elseif ($ending) { "Finished $tool" } else { "Using $tool" }
  }
  return @{ summary = $summary; detail = $detail }
}

try {
  [Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
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
  $kinds = @{ SessionStart = 'start'; PreToolUse = 'activity'; PostToolUse = 'activity'; PostToolUseFailure = 'activity'; PermissionRequest = 'permission'; Stop = 'done'; SessionEnd = 'done'; Notification = 'system'; Error = 'error' }
  $kind = if ($kinds.ContainsKey($name)) { $kinds[$name] } else { 'system' }
  $session = [string]$payload.session_id
  if (!$session) { $session = [string]$payload.thread_id }
  if (!$session) { $session = [string]$payload.turn_id }
  if (!$session) { $session = 'local' }
  $session = $session.Substring(0, [Math]::Min(120, $session.Length))

  $detail = ''
  $permissionDeadline = $null
  $summary = if ($kind -eq 'start') { 'Session started' }
    elseif ($kind -eq 'done') {
      if ($name -eq 'Stop') { $detail = Protect-Text $payload.last_assistant_message 4000 }
      if ($detail) { 'Final response' } else { 'Session finished' }
    }
    elseif ($kind -eq 'error') { 'Session needs attention' }
    elseif ($kind -in @('activity', 'permission')) {
      $activity = Get-ToolActivity $payload $name
      if ($kind -eq 'permission') {
        if ($activity.detail -and (Is-HubRunning $heartbeat)) {
          $detail = $activity.detail
          $permissionDeadline = [DateTimeOffset]::UtcNow.AddSeconds(55)
          $activity.summary
        } else {
          $kind = 'activity'
          $appName = if ($Provider -eq 'codex') { 'Codex' } else { 'Claude Code' }
          "Approval in $appName - $($activity.summary)"
        }
      } else {
        $activity.summary
      }
    }
    else { Protect-Text $payload.message 180 }
  if (!$summary) { $summary = $name }
  if (!$summary) { $summary = 'Agent event' }
  $summary = Limit-Text ($summary -replace '\s+', ' ').Trim() 180

  $id = [Guid]::NewGuid().ToString()
  $event = @{
    id = $id; provider = $Provider; session_id = "${Provider}:${session}";
    kind = $kind; summary = $summary; detail = $detail;
    happened_at = [DateTime]::UtcNow.ToString('o');
    expires_at = if ($permissionDeadline) { $permissionDeadline.ToUnixTimeSeconds() } else { $null }
  }
  $temporary = Join-Path $inbox ".$id.tmp"
  $destination = Join-Path $inbox "$id.json"
  [IO.File]::WriteAllText($temporary, ($event | ConvertTo-Json -Compress -Depth 8), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $destination -Force
  if ($Provider -eq 'codex' -and $name -eq 'Stop') { '{}' }

  if ($permissionDeadline) {
    $decisionFile = Join-Path $decisions "$id.json"
    while ([DateTimeOffset]::UtcNow -lt $permissionDeadline -and (Is-HubRunning $heartbeat)) {
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
  [Console]::Error.WriteLine('Queueglow hook could not process an event.')
}
