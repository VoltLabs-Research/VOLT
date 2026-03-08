export interface EnqueueSSHImportJobInput {
    teamId: string;
    sshConnectionId: string;
    remotePath: string;
    userId: string;
    host: string;
    username: string;
}

export interface EnqueueSSHImportJobOutput {
    jobId: string;
    sessionId: string;
}

export interface ISSHImportQueue {
    enqueueImportJob(input: EnqueueSSHImportJobInput): Promise<EnqueueSSHImportJobOutput>;
}
