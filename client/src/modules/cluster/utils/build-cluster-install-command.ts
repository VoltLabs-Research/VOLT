import { getBackendOrigin } from '@/app/core/http/utils/backend-origin';

export enum ClusterInstallPlatform {
    Windows = 'windows',
    MacOS = 'macos',
    Linux = 'linux'
}

interface ClusterInstallPlatformOption {
    id: ClusterInstallPlatform;
    label: string;
};

export const CLUSTER_INSTALL_PLATFORM_OPTIONS: ReadonlyArray<ClusterInstallPlatformOption> = [
    {
        id: ClusterInstallPlatform.Windows,
        label: 'Windows'
    },
    {
        id: ClusterInstallPlatform.Linux,
        label: 'Linux'
    },
    {
        id: ClusterInstallPlatform.MacOS,
        label: 'macOS'
    }
];

/**
 * Narrows a toggle group's emitted key back to the enum. bravais's `SegmentedTabs`
 * was generic over its own id union and handed the value back already typed;
 * React Aria's selection is a `Set<Key>`, so the check happens against the option
 * list itself rather than through an assertion.
 */
export const isClusterInstallPlatform = (value: string): value is ClusterInstallPlatform => {
    return CLUSTER_INSTALL_PLATFORM_OPTIONS.some((option) => option.id === value);
};

const CLUSTER_DAEMON_SCRIPTS_BASE_URL = 'https://raw.githubusercontent.com/voltlabs-research/VOLT/main/cluster/scripts';

const escapePowerShellSingleQuotedString = (value: string): string => {
    return value.replace(/'/g, "''");
};

export const getDefaultClusterInstallPlatform = (): ClusterInstallPlatform => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) {
        return ClusterInstallPlatform.Windows;
    }

    if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
        return ClusterInstallPlatform.MacOS;
    }

    return ClusterInstallPlatform.Linux;
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
    platform: ClusterInstallPlatform = getDefaultClusterInstallPlatform()
): string => {
    const cloudUrl = getBackendOrigin();
    if (platform === ClusterInstallPlatform.Windows) {
        return buildWindowsInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
    }

    return buildPosixInstallCommand(teamClusterId, enrollmentToken, cloudUrl);
};
