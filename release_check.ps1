param(
  [switch]$QuickCheck,
  [switch]$InstallDeps,
  [int]$StepTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$npmCommand = if ($env:OS -eq "Windows_NT") {
  (Get-Command "npm.cmd" -ErrorAction Stop).Source
} else {
  (Get-Command "npm" -ErrorAction Stop).Source
}

function Write-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }

function Run-WithTimeout {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [int]$TimeoutSec,
    [string]$Name
  )

  $start = Get-Date
  Write-Info "START $Name at $($start.ToString('yyyy-MM-dd HH:mm:ss'))"

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = [string]::Join(' ', $ArgumentList)
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $false
  $psi.RedirectStandardError = $false
  $psi.CreateNoWindow = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()
  $ok = $proc.WaitForExit($TimeoutSec * 1000)

  if (-not $ok) {
    try { $proc.Kill() } catch {}
    $end = Get-Date
    Write-Fail "TIMEOUT $Name at $($end.ToString('yyyy-MM-dd HH:mm:ss'))"
    return $false
  }

  $exitCode = $proc.ExitCode
  $end = Get-Date
  if ($exitCode -eq 0) {
    Write-Pass "END $Name at $($end.ToString('yyyy-MM-dd HH:mm:ss'))"
    return $true
  }

  Write-Fail "END $Name at $($end.ToString('yyyy-MM-dd HH:mm:ss')) with exit $exitCode"
  return $false
}

$failed = $false

try {
  python --version | Out-Null
  Write-Pass "Python available"
} catch {
  Write-Fail "Python is not available"
  $failed = $true
}

if (Test-Path "requirements.txt") {
  Write-Pass "requirements.txt exists"
} else {
  Write-Fail "requirements.txt missing"
  $failed = $true
}

if (Test-Path ".env") {
  Write-Pass ".env exists"
} else {
  Write-Info ".env missing; Mock mode remains available and release artifacts stay secret-free"
}

if ($InstallDeps) {
  Write-Info "Installing dependencies because -InstallDeps is set"
  $ok = Run-WithTimeout -FilePath "python" -ArgumentList @("-m", "pip", "install", "-r", "requirements.txt") -TimeoutSec $StepTimeoutSeconds -Name "pip install"
  if (-not $ok) { $failed = $true }
} else {
  Write-Info "Skip dependency installation (default)"
}

$requiredFiles = @(
  "README.md",
  "LICENSE",
  ".gitignore",
  ".env.example",
  "start_windows.bat",
  "launch.py",
  "内阁-ai-app/index.html",
  "backend/main.py"
)

foreach ($f in $requiredFiles) {
  if (Test-Path $f) { Write-Pass "$f exists" } else { Write-Fail "$f missing"; $failed = $true }
}

if ($QuickCheck) {
  Write-Info "QuickCheck mode: skip full validations"
} else {
  $scripts = @(
    "scripts\validate_all.py",
    "scripts\validate_profile_format.py",
    "scripts\validate_app_targets.py",
    "scripts\validate_desktop_skeleton.py",
    "scripts\validate_secret_scan.py"
  )

  foreach ($script in $scripts) {
    $ok = Run-WithTimeout -FilePath "python" -ArgumentList @($script) -TimeoutSec $StepTimeoutSeconds -Name "python $script"
    if (-not $ok) { $failed = $true }
  }

  $pytestOk = Run-WithTimeout -FilePath "python" -ArgumentList @("-m", "pytest", "backend/tests", "-q") -TimeoutSec $StepTimeoutSeconds -Name "backend tests"
  if (-not $pytestOk) { $failed = $true }

  $lintOk = Run-WithTimeout -FilePath $npmCommand -ArgumentList @("run", "lint", "--prefix", "内阁-ai-app") -TimeoutSec $StepTimeoutSeconds -Name "frontend lint"
  if (-not $lintOk) { $failed = $true }

  $buildOk = Run-WithTimeout -FilePath $npmCommand -ArgumentList @("run", "build", "--prefix", "内阁-ai-app") -TimeoutSec $StepTimeoutSeconds -Name "frontend build"
  if (-not $buildOk) { $failed = $true }
}

if ($failed) {
  Write-Host "`nRELEASE CHECK: FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "`nRELEASE CHECK: PASS" -ForegroundColor Green
exit 0
