import type { SSHFileEntry } from '@/modules/ssh/api/entities/ssh-connection';

export interface ListSSHFilesParams {
    sshConnectionId: string;
    path?: string;
};

export interface ListSSHFilesResponse {
    cwd: string;
    entries: SSHFileEntry[];
};

export type ListSSHFilesInputDTO = ListSSHFilesParams;

export type ListSSHFilesOutputDTO = ListSSHFilesResponse;
