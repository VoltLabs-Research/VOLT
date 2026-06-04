[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TeamClusterId,

    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken,

    [string]$VoltCloudUrl = $env:VOLT_CLOUD_URL,
    [string]$InstallVersion = '1.0.0',
    [string]$InstallRoot = $env:TEAM_CLUSTER_INSTALL_ROOT,
    [switch]$InstallDockerDesktopOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-InstallLog {
    param([string]$Message)

    Write-Host "[install] $Message"
}

function Fail-Install {
    param([string]$Message)

    throw "[install] $Message"
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-InteractiveDesktop {
    if ($env:CI) {
        Fail-Install 'Automatic Docker Desktop installation on Windows is not supported in CI or headless sessions.'
    }

    if (-not [Environment]::UserInteractive) {
        Fail-Install 'Automatic Docker Desktop installation on Windows requires an interactive desktop session.'
    }
}

function Get-InstallRoot {
    if ($InstallRoot -and $InstallRoot.Trim()) {
        return $InstallRoot.Trim().TrimEnd('\\', '/')
    }

    if (-not $env:LOCALAPPDATA) {
        Fail-Install 'LOCALAPPDATA is required to determine the default installation directory.'
    }

    return [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Volt', 'team-clusters')
}

function Get-VoltCloudUrl {
    if (-not $VoltCloudUrl -or -not $VoltCloudUrl.Trim()) {
        if ($env:VOLT_CLOUD_SERVER_URL -and $env:VOLT_CLOUD_SERVER_URL.Trim()) {
            return $env:VOLT_CLOUD_SERVER_URL.Trim().TrimEnd('/')
        }

        Fail-Install 'Set VOLT_CLOUD_URL or VOLT_CLOUD_SERVER_URL before running the installer.'
    }

    return $VoltCloudUrl.Trim().TrimEnd('/')
}

function Test-PerUserInstallRoot {
    param([string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $userProfile = [System.IO.Path]::GetFullPath($env:USERPROFILE)
    return $fullPath.StartsWith($userProfile, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-InstallRootAccess {
    param([string]$ResolvedInstallRoot)

    if (Test-IsAdministrator) {
        return
    }

    if (Test-PerUserInstallRoot -Path $ResolvedInstallRoot) {
        return
    }

    Fail-Install 'A non-elevated Windows install requires TEAM_CLUSTER_INSTALL_ROOT to stay inside the current user profile.'
}

function Invoke-VoltJsonPost {
    param(
        [string]$Url,
        [hashtable]$Payload
    )

    try {
        $body = $Payload | ConvertTo-Json -Depth 10
        $response = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
        return $response.Content | ConvertFrom-Json
    } catch {
        $webException = $_.Exception
        while ($webException -and -not ($webException -is [System.Net.WebException])) {
            $webException = $webException.InnerException
        }
        if (-not $webException) {
            throw
        }
        $response = $webException.Response
        if (-not $response) {
            throw
        }

        $stream = $response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $rawBody = $reader.ReadToEnd()
        $reader.Dispose()
        $stream.Dispose()

        try {
            $errorPayload = $rawBody | ConvertFrom-Json
            $message = if ($errorPayload.message) { $errorPayload.message } elseif ($errorPayload.code) { $errorPayload.code } else { $rawBody }
            Fail-Install "HTTP $([int]$response.StatusCode): $message"
        } catch {
            Fail-Install "HTTP $([int]$response.StatusCode): $rawBody"
        }
    }
}

function Test-DockerReady {
    try {
        docker version | Out-Null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }

        docker info | Out-Null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }

        docker compose version | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-ForDockerReady {
    $timeoutSeconds = 300
    $startedAt = Get-Date

    Write-InstallLog 'Waiting for Docker daemon and Compose to become ready'

    while ((Get-Date) -lt $startedAt.AddSeconds($timeoutSeconds)) {
        if (Test-DockerReady) {
            Write-InstallLog 'Docker is ready'
            return
        }

        Start-Sleep -Seconds 5
    }

    Fail-Install "Docker did not become ready within ${timeoutSeconds}s"
}

function Get-DockerDesktopPath {
    $candidates = @(
        [System.IO.Path]::Combine($env:ProgramFiles, 'Docker', 'Docker', 'Docker Desktop.exe'),
        [System.IO.Path]::Combine($env:LocalAppData, 'Programs', 'Docker', 'Docker', 'Docker Desktop.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Invoke-ElevatedDockerDesktopInstall {
    param([string]$ResolvedInstallRoot)

    $currentShellPath = (Get-Process -Id $PID).Path
    $argumentList = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath,
        '-TeamClusterId', $TeamClusterId,
        '-EnrollmentToken', $EnrollmentToken,
        '-InstallVersion', $InstallVersion,
        '-InstallRoot', $ResolvedInstallRoot,
        '-InstallDockerDesktopOnly'
    )

    if ($VoltCloudUrl -and $VoltCloudUrl.Trim()) {
        $argumentList += @('-VoltCloudUrl', $VoltCloudUrl)
    }

    Write-InstallLog 'Requesting elevation to install Docker Desktop'
    $process = Start-Process -FilePath $currentShellPath -Verb RunAs -ArgumentList $argumentList -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Fail-Install "Elevated Docker Desktop installation failed with exit code $($process.ExitCode)."
    }
}

function Start-DockerDesktop {
    $dockerDesktopPath = Get-DockerDesktopPath
    if (-not $dockerDesktopPath) {
        Fail-Install 'Docker Desktop executable was not found after installation.'
    }

    Write-InstallLog 'Launching Docker Desktop'
    Start-Process -FilePath $dockerDesktopPath | Out-Null
}

function Install-DockerDesktopWithWinget {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        return $false
    }

    Write-InstallLog 'Installing Docker Desktop with winget'
    & winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Fail-Install 'winget could not install Docker Desktop automatically.'
    }

    return $true
}

function Install-DockerDesktopFromOfficialInstaller {
    $processorArchitecture = $env:PROCESSOR_ARCHITECTURE
    $downloadArchitecture = if ($processorArchitecture -eq 'ARM64') { 'arm64' } else { 'amd64' }
    $installerUrl = "https://desktop.docker.com/win/main/$downloadArchitecture/Docker%20Desktop%20Installer.exe"
    $installerPath = Join-Path $env:TEMP 'DockerDesktopInstaller.exe'

    Write-InstallLog 'Downloading Docker Desktop installer'
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

    Write-InstallLog 'Running Docker Desktop installer'
    $installerProcess = Start-Process -FilePath $installerPath -ArgumentList 'install', '--quiet' -Wait -PassThru
    if ($installerProcess.ExitCode -ne 0) {
        Fail-Install "Docker Desktop installer exited with code $($installerProcess.ExitCode)."
    }
}

function Ensure-DockerDesktopInstalled {
    param([string]$ResolvedInstallRoot)

    if (Get-DockerDesktopPath) {
        return
    }

    Assert-InteractiveDesktop

    if (-not (Test-IsAdministrator)) {
        Invoke-ElevatedDockerDesktopInstall -ResolvedInstallRoot $ResolvedInstallRoot
        return
    }

    if (-not (Install-DockerDesktopWithWinget)) {
        Install-DockerDesktopFromOfficialInstaller
    }
}

function Ensure-DockerDesktop {
    param([string]$ResolvedInstallRoot)

    if (Test-DockerReady) {
        return
    }

    Assert-InteractiveDesktop

    if (Get-DockerDesktopPath) {
        Start-DockerDesktop
        Wait-ForDockerReady
        return
    }

    Ensure-DockerDesktopInstalled -ResolvedInstallRoot $ResolvedInstallRoot

    Start-DockerDesktop
    Wait-ForDockerReady
}

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 0)
    $listener.Start()
    $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    return $port
}

function Get-UniquePortMap {
    $portMap = [ordered]@{}
    $allocatedPorts = [System.Collections.Generic.HashSet[int]]::new()
    $serviceNames = @('minio', 'redis', 'mongodb', 'daemon')

    foreach ($serviceName in $serviceNames) {
        do {
            $candidatePort = Get-FreePort
        } while ($allocatedPorts.Contains($candidatePort))

        $allocatedPorts.Add($candidatePort) | Out-Null
        $portMap[$serviceName] = $candidatePort
    }

    return $portMap
}

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Contents
    )

    $directoryPath = Split-Path -Parent $Path
    if ($directoryPath) {
        New-Item -ItemType Directory -Force -Path $directoryPath | Out-Null
    }

    $utf8Encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, "$Contents`n", $utf8Encoding)
}

function Materialize-Manifest {
    param(
        [pscustomobject]$Manifest,
        [string]$TargetDirectory
    )

    New-Item -ItemType Directory -Force -Path $TargetDirectory | Out-Null

    foreach ($fileEntry in $Manifest.files) {
        $targetPath = Join-Path $TargetDirectory $fileEntry.path
        Write-Utf8File -Path $targetPath -Contents $fileEntry.contents
    }

    Write-Utf8File -Path (Join-Path $TargetDirectory '.compose-project-name') -Contents $Manifest.composeProjectName
    Write-Utf8File -Path (Join-Path $TargetDirectory '.install-manifest-version') -Contents $Manifest.manifestVersion

    if ($Manifest.buildContextArchiveBase64) {
        if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
            Fail-Install 'The Windows tar utility is required to extract the daemon build context.'
        }

        $archivePath = Join-Path $env:TEMP 'volt-cluster-daemon-build-context.tar.gz'
        $clusterDaemonDirectory = Join-Path $TargetDirectory 'cluster-daemon'
        [System.IO.File]::WriteAllBytes($archivePath, [Convert]::FromBase64String($Manifest.buildContextArchiveBase64))
        New-Item -ItemType Directory -Force -Path $clusterDaemonDirectory | Out-Null
        tar -xzf $archivePath -C $clusterDaemonDirectory
        if ($LASTEXITCODE -ne 0) {
            Fail-Install 'Failed to extract the daemon build context archive.'
        }

        Remove-Item -LiteralPath $archivePath -Force
    }
}

function Wait-ForDaemonReady {
    param([string]$ComposeProjectName)

    $containerName = "$ComposeProjectName-daemon-1"
    $timeoutSeconds = 90
    $startedAt = Get-Date

    Write-InstallLog "Waiting for daemon readiness (container: $containerName)"

    while ((Get-Date) -lt $startedAt.AddSeconds($timeoutSeconds)) {
        try {
            $logs = docker logs $containerName 2>&1
            if ($logs -match 'cluster-daemon started for team cluster') {
                Write-InstallLog 'Daemon is ready'
                return
            }
        } catch {
        }

        Start-Sleep -Seconds 3
    }

    try {
        Write-InstallLog 'Daemon logs at timeout:'
        docker logs --tail 20 $containerName 2>&1 | Write-Host
    } catch {
    }

    Fail-Install "Daemon did not become ready within ${timeoutSeconds}s"
}

function Print-Summary {
    param(
        [System.Collections.IDictionary]$Ports,
        [string]$ResolvedInstallRoot
    )

    Write-InstallLog 'Provisioning assets installed'
    Write-InstallLog "Install root: $ResolvedInstallRoot"
    Write-InstallLog "MinIO port: $($Ports.minio)"
    Write-InstallLog "Redis port: $($Ports.redis)"
    Write-InstallLog "MongoDB port: $($Ports.mongodb)"
}

try {
    $resolvedInstallRoot = Get-InstallRoot

    if ($InstallDockerDesktopOnly) {
        Ensure-DockerDesktopInstalled -ResolvedInstallRoot $resolvedInstallRoot
        exit 0
    }

    $resolvedCloudUrl = Get-VoltCloudUrl
    Assert-InstallRootAccess -ResolvedInstallRoot $resolvedInstallRoot

    Write-InstallLog 'Checking Docker availability'
    Ensure-DockerDesktop -ResolvedInstallRoot $resolvedInstallRoot

    $ports = Get-UniquePortMap

    Write-InstallLog 'Requesting daemon credentials from VoltCloud'
    $healthcheckResponse = Invoke-VoltJsonPost -Url "$resolvedCloudUrl/api/team-clusters/$TeamClusterId/healthcheck" -Payload @{
        enrollmentToken = $EnrollmentToken
        installedVersion = $InstallVersion
    }
    $daemonPassword = $healthcheckResponse.data.daemonPassword

    Write-InstallLog 'Downloading install manifest'
    $manifestResponse = Invoke-VoltJsonPost -Url "$resolvedCloudUrl/api/team-clusters/$TeamClusterId/install-manifest" -Payload @{
        daemonPassword = $daemonPassword
        installRoot = $resolvedInstallRoot
        ports = $ports
    }
    $manifest = $manifestResponse.data.manifest

    $installDirectory = Join-Path $resolvedInstallRoot $TeamClusterId

    Write-InstallLog 'Materializing deployment files'
    Materialize-Manifest -Manifest $manifest -TargetDirectory $installDirectory

    Write-InstallLog 'Starting Team Cluster stack'
    docker compose --project-name $manifest.composeProjectName --project-directory $installDirectory --file (Join-Path $installDirectory 'docker-compose.yml') up -d | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Fail-Install 'docker compose up failed while starting the Team Cluster stack.'
    }

    Wait-ForDaemonReady -ComposeProjectName $manifest.composeProjectName
    Print-Summary -Ports $ports -ResolvedInstallRoot $resolvedInstallRoot
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
