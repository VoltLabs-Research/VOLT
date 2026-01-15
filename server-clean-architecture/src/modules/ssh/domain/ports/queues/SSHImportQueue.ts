export interface SSHImportJobProps {
    jobId: string;
    sshConnectionId: string;
    remotePath: string;
    teamId: string;
    userId: string;
    name: string;
    message: string;
    sessionId?: string;
};