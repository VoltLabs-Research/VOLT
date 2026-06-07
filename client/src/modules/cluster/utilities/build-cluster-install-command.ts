import { getBackendOrigin } from '@/app/core/http/utilities/backend-origin';

export enum ClusterInstallPlatform {
    Windows = 'windows',
    MacOS = 'macos',
    Linux = 'linux',
    Unknown = 'unknown'
}

export type SupportedClusterInstallPlatform =
    | ClusterInstallPlatform.Windows
    | ClusterInstallPlatform.Linux
    | ClusterInstallPlatform.MacOS;

export interface ClusterInstallPlatformOption {
    id: SupportedClusterInstallPlatform;
    label: string;
};

export const CLUSTER_INSTALL_PLATFORM_OPTIONS: ReadonlyArray<ClusterInstallPlatformOption> = [
    { id: ClusterInstallPlatform.Windows, label: 'Windows' },
    { id: ClusterInstallPlatform.Linux, label: 'Linux' },
    { id: ClusterInstallPlatform.MacOS, label: 'macOS' }
];

const CLUSTER_DAEMON_SCRIPTS_BASE_URL = 'https://raw.githubusercontent.com/voltlabs-research/clusterdaemon/main/scripts';

const escapePowerShellSingleQuotedString = (value: string): string => {
    return value.replace(/'/g, "''");
};

const detectBrowserInstallPlatform = (): ClusterInstallPlatform => {
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

const isSupportedClusterInstallPlatform = (platform: ClusterInstallPlatform): platform is SupportedClusterInstallPlatform => {
    return CLUSTER_INSTALL_PLATFORM_OPTIONS.some((option) => option.id === platform);
};

export const getDefaultClusterInstallPlatform = (): SupportedClusterInstallPlatform => {
    const detectedPlatform = detectBrowserInstallPlatform();
    return isSupportedClusterInstallPlatform(detectedPlatform)
        ? detectedPlatform
        : ClusterInstallPlatform.Linux;
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
    platform: SupportedClusterInstallPlatform = getDefaultClusterInstallPlatform()
): string => {
    const cloudUrl = getBackendOrigin();
    if (platform === ClusterInstallPlatform.Windows) {
        return buildWindowsInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
    }

    return buildPosixInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
};
