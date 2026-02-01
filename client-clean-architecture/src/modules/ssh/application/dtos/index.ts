export type { SSHConnection } from '@/modules/ssh/domain/entities/SSHConnection';
export type { SSHFileEntry, FileEntryType } from '@/modules/ssh/domain/entities/SSHFileEntry';

export type {
    CreateSSHConnectionParams,
    UpdateSSHConnectionParams,
    ListSSHFilesParams,
    ListSSHFilesResponse,
    TestSSHConnectionResponse
} from '@/modules/ssh/domain/ports/ISSHRepository';
