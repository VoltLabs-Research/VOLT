const useClusterId = (path: string): string => {
    const clusterId = process.env.CLUSTER_ID || 'main-cluster';
    return `${clusterId}/${path}`;
};

export default useClusterId;