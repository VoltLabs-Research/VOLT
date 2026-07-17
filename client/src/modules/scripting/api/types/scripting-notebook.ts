import type { User } from '@/modules/auth/api/types/user';
import type { TeamCluster } from '@/modules/cluster/api/types/team-cluster';

export interface ScriptingNotebookTrajectory {
    _id: string;
    name?: string;
};

export interface ScriptingNotebookContainerResources {
    cpus: number;
    memoryMB: number;
};

export interface ScriptingNotebook {
    _id: string;
    teamCluster?: TeamCluster | string | null;
    containerResources?: ScriptingNotebookContainerResources | null;
    title: string;
    notebookPath: string;
    trajectory?: ScriptingNotebookTrajectory | string | null;
    createdBy?: User | string;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};
