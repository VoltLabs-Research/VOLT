export const buildClusterInstallCommand = (teamClusterId: string, enrollmentToken: string): string => {
    return `curl -sSL https://raw.githubusercontent.com/voltlabs-research/volt/tools/setup-cluster.sh | bash "${teamClusterId}" "${enrollmentToken}"`;
};
