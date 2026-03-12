import type { User } from '@/modules/auth/api/entities/user';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface ScriptingNotebookTrajectory {
    _id: string;
    name?: string;
};

export interface ScriptingNotebook {
    _id: string;
    teamCluster?: TeamCluster | string | null;
    title: string;
    notebookPath: string;
    trajectory?: ScriptingNotebookTrajectory | string | null;
    trajectories?: Array<ScriptingNotebookTrajectory | string>;
    createdBy?: User | string;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};
