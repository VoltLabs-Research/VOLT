import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';

export { TeamClusterStatus };

export interface DashboardTeamClusterService {
    port: number | null;
};

export interface DashboardTeamClusterServices {
    minio: DashboardTeamClusterService;
    redis: DashboardTeamClusterService;
    mongodb: DashboardTeamClusterService;
    daemon: DashboardTeamClusterService;
};

export interface DashboardTeamCluster {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: DashboardTeamClusterServices;
    createdAt: Date;
    updatedAt: Date;
};
