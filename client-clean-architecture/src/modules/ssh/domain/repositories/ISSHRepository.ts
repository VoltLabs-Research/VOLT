import type { SSHConnection, SSHFileListResponse } from '../entities';

export interface ISSHRepository {
    getConnections(): Promise<SSHConnection[]>;
    createConnection(data: any): Promise<SSHConnection>;
    updateConnection(id: string, data: any): Promise<SSHConnection>;
    deleteConnection(id: string): Promise<void>;
    testConnection(id: string): Promise<{ valid: boolean; error?: string }>;
    listFiles(params: { connectionId: string; path: string }): Promise<SSHFileListResponse>;
    importFile(data: { connectionId: string; remotePath: string; teamId: string; trajectoryName?: string }): Promise<void>;
}
