export interface CreateJupyterSessionInput{
    teamId: string;
    userId: string;
    trajectoryId?: string;
    notebookId?: string;
    teamClusterId?: string;
}
