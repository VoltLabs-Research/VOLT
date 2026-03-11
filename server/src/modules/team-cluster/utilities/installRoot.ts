const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:\\/;
const WINDOWS_UNC_PATTERN = /^\\\\/;

export const DEFAULT_TEAM_CLUSTER_INSTALL_ROOT = '/opt/volt/team-clusters';

const escapePosixSingleQuotedString = (value: string): string => {
    return value.replace(/'/g, `'"'"'`);
};

const escapePowerShellSingleQuotedString = (value: string): string => {
    return value.replace(/'/g, "''");
};

export const normalizeTeamClusterInstallRoot = (installRoot?: string | null): string => {
    const trimmedInstallRoot = installRoot?.trim();
    if (!trimmedInstallRoot) {
        return DEFAULT_TEAM_CLUSTER_INSTALL_ROOT;
    }

    const normalizedInstallRoot = trimmedInstallRoot.replace(/[\\/]+$/g, '');
    return normalizedInstallRoot || trimmedInstallRoot;
};

export const isWindowsInstallRoot = (installRoot: string): boolean => {
    return WINDOWS_DRIVE_PATTERN.test(installRoot) || WINDOWS_UNC_PATTERN.test(installRoot);
};

export const buildTeamClusterInstallDirectory = (teamClusterId: string, installRoot?: string | null): string => {
    const normalizedInstallRoot = normalizeTeamClusterInstallRoot(installRoot);
    const pathSeparator = isWindowsInstallRoot(normalizedInstallRoot) ? '\\' : '/';

    return `${normalizedInstallRoot}${pathSeparator}${teamClusterId}`;
};

export const buildManualTeamClusterUninstallCommand = (teamClusterId: string, installRoot?: string | null): string => {
    const installDirectory = buildTeamClusterInstallDirectory(teamClusterId, installRoot);
    if (isWindowsInstallRoot(installDirectory)) {
        const escapedInstallDirectory = escapePowerShellSingleQuotedString(installDirectory);
        return `powershell -NoProfile -ExecutionPolicy Bypass -Command \"$installDir='${escapedInstallDirectory}'; if (Test-Path -LiteralPath $installDir) { Set-Location -LiteralPath $installDir; docker compose down -v --remove-orphans; Remove-Item -LiteralPath $installDir -Recurse -Force }\"`;
    }

    const escapedInstallDirectory = escapePosixSingleQuotedString(installDirectory);
    return `sudo bash -lc 'if [ -d "${escapedInstallDirectory}" ]; then cd "${escapedInstallDirectory}" && docker compose down -v --remove-orphans; fi && rm -rf "${escapedInstallDirectory}"'`;
};
