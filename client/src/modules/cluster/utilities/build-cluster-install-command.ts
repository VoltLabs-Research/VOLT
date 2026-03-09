export const buildClusterInstallCommand = (teamClusterId: string, enrollmentToken: string): string => {
    const cloudUrl = import.meta.env.VITE_API_URL;

    return `curl -sSL https://raw.githubusercontent.com/voltlabs-research/volt/main/tools/setup-cluster.sh | VOLT_CLOUD_URL="${cloudUrl}" bash -s -- "${teamClusterId}" "${enrollmentToken}"`;
};
