import { BaseJob } from '@/types/queues/base-processing-queue';

export interface SSHImportJob extends BaseJob{
    sshConnectionId: string;
    remotePath: string;
    userId: string;
};