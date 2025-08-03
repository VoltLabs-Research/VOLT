export interface ClientData{
    teamId: string;
    initStartTime: number;
    pendingUpdates: any[];
}

export type ProcessingQueue = {
  name: string;
  queue: ReturnType<typeof getTrajectoryProcessingQueue> | ReturnType<typeof getAnalysisQueue>;
};