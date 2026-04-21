export enum ClusterInstallPlatform {
    Windows = 'windows',
    MacOS = 'macos',
    Linux = 'linux',
    Unknown = 'unknown'
};

const CLUSTER_DAEMON_SCRIPTS_BASE_URL = 'https://raw.githubusercontent.com/voltlabs-research/clusterdaemon/main/scripts';

const escapePowerShellSingleQuotedString = (value: string): string => {
    return value.replace(/'/g, "''");
};

const detectBrowserInstallPlatform = (): ClusterInstallPlatform => {
    if (typeof navigator === 'undefined') {
        return ClusterInstallPlatform.Unknown;
    }

    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) {
        return ClusterInstallPlatform.Windows;
    }

    if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
        return ClusterInstallPlatform.MacOS;
    }

    if (userAgent.includes('Linux')) {
        return ClusterInstallPlatform.Linux;
    }

    return ClusterInstallPlatform.Unknown;
};

export const detectClusterInstallPlatform = (): ClusterInstallPlatform => {
    return detectBrowserInstallPlatform();
};

const buildPosixInstallCommand = (teamClusterId: string, enrollmentToken: string, cloudUrl: string): string => {
    const scriptUrl = `${CLUSTER_DAEMON_SCRIPTS_BASE_URL}/install.sh`;
    return `curl -sSL ${scriptUrl} | VOLT_CLOUD_URL="${cloudUrl}" bash -s -- "${teamClusterId}" "${enrollmentToken}"`;
};

const buildWindowsInstallCommand = (teamClusterId: string, enrollmentToken: string, cloudUrl: string): string => {
    const scriptUrl = escapePowerShellSingleQuotedString(`${CLUSTER_DAEMON_SCRIPTS_BASE_URL}/install.ps1`);
    const escapedTeamClusterId = escapePowerShellSingleQuotedString(teamClusterId);
    const escapedEnrollmentToken = escapePowerShellSingleQuotedString(enrollmentToken);
    const escapedCloudUrl = escapePowerShellSingleQuotedString(cloudUrl);
    const command = [
        "$scriptPath = Join-Path $env:TEMP 'volt-cluster-install.ps1'",
        `Invoke-WebRequest -UseBasicParsing '${scriptUrl}' -OutFile $scriptPath`,
        `& $scriptPath -TeamClusterId '${escapedTeamClusterId}' -EnrollmentToken '${escapedEnrollmentToken}' -VoltCloudUrl '${escapedCloudUrl}'`
    ].join('; ');

    return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`;
};

export const buildClusterInstallCommand = (
    teamClusterId: string,
    enrollmentToken: string,
    platform: ClusterInstallPlatform = detectClusterInstallPlatform()
): string => {
    const cloudUrl = import.meta.env.VITE_API_URL;
    if (platform === ClusterInstallPlatform.Windows) {
        return buildWindowsInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
    }

    return buildPosixInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
};
