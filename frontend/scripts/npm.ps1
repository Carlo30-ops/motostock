<#
  Ejecuta npm aunque no este en el PATH de la sesion actual (p. ej. terminal integrada de Cursor
  sin el mismo PATH que Windows). Busca npm.cmd en ubicaciones tipicas y anteponde su carpeta al PATH.

  Uso (desde motostock/frontend):
    .\scripts\npm.ps1 install
    .\scripts\npm.ps1 run typecheck
    .\scripts\npm.ps1 run build
#>
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$NpmArgs
)

function Find-NpmCmd {
  $existing = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($existing) {
    return $existing.Source
  }

  foreach ($varName in @("NVM_SYMLINK", "NVM_HOME")) {
    foreach ($scope in @("Process", "User", "Machine")) {
      $root = [Environment]::GetEnvironmentVariable($varName, $scope)
      if (-not $root) { continue }
      $candidate = Join-Path $root "npm.cmd"
      if (Test-Path -LiteralPath $candidate) {
        return $candidate
      }
    }
  }

  $dirs = @(
    (Join-Path $env:ProgramFiles "nodejs"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs"),
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs"),
    (Join-Path $env:LOCALAPPDATA "Volta\bin"),
    (Join-Path $env:USERPROFILE "scoop\apps\nodejs\current"),
    (Join-Path $env:USERPROFILE "scoop\persist\nodejs-lts\current")
  )

  foreach ($dir in $dirs) {
    if (-not $dir) { continue }
    $candidate = Join-Path $dir "npm.cmd"
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  $fnmDir = Join-Path $env:USERPROFILE ".fnm\node-versions"
  if (Test-Path $fnmDir) {
    $nv = Get-ChildItem -Path $fnmDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($nv) {
      $nested = Get-ChildItem -Path $nv.FullName -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($nested) {
        $npmFnm = Join-Path $nested.FullName "installation\npm.cmd"
        if (Test-Path -LiteralPath $npmFnm) {
          return $npmFnm
        }
      }
    }
  }

  return $null
}

$npmCmd = Find-NpmCmd
if (-not $npmCmd) {
  Write-Error @"
No se encontro npm (npm.cmd).

Opciones:
  1) Instala Node.js LTS desde https://nodejs.org (incluye npm y suele anadirse al PATH del sistema).
  2) Cierra y vuelve a abrir el terminal / Cursor tras instalar Node.
  3) Si usas nvm-windows o fnm, abre un PowerShell donde ya funcione 'npm -v' y ejecuta los comandos alli.

Para comprobar en Windows: where.exe npm
"@
  exit 1
}

$binDir = Split-Path -Parent $npmCmd
if ($env:PATH -notlike "*$binDir*") {
  $env:PATH = "$binDir;$env:PATH"
}

Write-Host "Usando: $npmCmd" -ForegroundColor DarkGray
& $npmCmd @NpmArgs
exit $LASTEXITCODE
