import sshApi from '@/services/api/ssh/ssh';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSSHConnectionData { name: string; host: string; port?: number; username: string; password: string }
export interface UpdateSSHConnectionData { name?: string; host?: string; port?: number; username?: string; password?: string }

export interface SSHConnectionState {
    connections: SSHConnection[];
    loading: boolean;
    error: string | null;
}

export interface SSHConnectionActions {
    fetchConnections: () => Promise<void>;
    createConnection: (data: CreateSSHConnectionData) => Promise<SSHConnection | null>;
    updateConnection: (id: string, data: UpdateSSHConnectionData) => Promise<SSHConnection | null>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (id: string) => Promise<{ valid: boolean; error?: string }>;
}

export type SSHConnectionSlice = SSHConnectionState & SSHConnectionActions;

export const initialState: SSHConnectionState = { connections: [], loading: false, error: null };

export const createSSHConnectionSlice: SliceCreator<SSHConnectionSlice> = (set, get) => ({
    ...initialState,

    fetchConnections: async () => {
        await runRequest(set, get, () => sshApi.connections.getAll(), {
            errorFallback: 'Error fetching SSH connections',
            onSuccess: (connections) => {
                set({ connections: connections } as Partial<SSHConnectionSlice>)
            }
        });
    },

    createConnection: async (data) => {
        return await runRequest(set, get, () => sshApi.connections.create(data), {
            errorFallback: 'Error creating SSH connection',
            rethrow: true,
            onSuccess: (conn) => set((s: SSHConnectionSlice) => ({ connections: [...s.connections, conn] }))
        });
    },

    updateConnection: async (id, data) => {
        return await runRequest(set, get, () => sshApi.connections.update?.(id, data) as Promise<SSHConnection>, {
            errorFallback: 'Error updating SSH connection',
            rethrow: true,
            onSuccess: (conn) => set((s: SSHConnectionSlice) => ({ connections: s.connections.map(c => c._id === id ? conn : c) }))
        });
    },

    deleteConnection: async (id) => {
        await runRequest(set, get, () => sshApi.connections.delete(id), {
            errorFallback: 'Error deleting SSH connection',
            rethrow: true,
            onSuccess: () => set((s: SSHConnectionSlice) => ({ connections: s.connections.filter(c => c._id !== id) }))
        });
    },

    testConnection: async (id) => {
        try { return await sshApi.connections.test(id); }
        catch (e: any) { return { valid: false, error: e?.response?.data?.data?.error || e?.message || 'Error testing' }; }
    }
});
