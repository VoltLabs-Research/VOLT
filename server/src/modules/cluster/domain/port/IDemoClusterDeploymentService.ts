import type TeamCluster from '@modules/cluster/domain/entities/TeamCluster';

export interface DemoClusterPlaintextCredentials {
    minioUsername: string;
    minioPassword: string;
    redisUsername: string;
    redisPassword: string;
    mongodbUsername: string;
    mongodbPassword: string;
    daemonPassword: string;
    enrollmentToken: string;
}

export interface IDemoClusterDeploymentService {
    deployDemoStack(teamCluster: TeamCluster, credentials: DemoClusterPlaintextCredentials): Promise<void>;
    teardownDemoStack(teamCluster: TeamCluster): Promise<void>;
}
