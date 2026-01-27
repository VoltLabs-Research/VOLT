import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { SSHConnection } from '../../domain/entities';
import { sshRepository } from '../../infrastructure/repositories/SSHRepository';

export interface SSHConnectionState {
    connections: SSHConnection[];
    loading: boolean;
    error: string | null;
}

export interface SSHConnectionActions {
    fetchConnections: () => Promise<void>;
    createConnection: (data: any) => Promise<SSHConnection | null>;
    updateConnection: (id: string, data: any) => Promise<SSHConnection | null>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (id: string) => Promise<{ valid: boolean; error?: string }>;
}

export type SSHConnectionSlice = SSHConnectionState & SSHConnectionActions;

export const initialState: SSHConnectionState = {
    connections: [],
    loading: false,
    error: null
};

export const createSSHConnectionSlice: SliceCreator<SSHConnectionSlice> = (set, get) => ({
    ...initialState,

    fetchConnections: async () => {
        const state = get();
        if (state.connections.length > 0) return;

        await runRequest(set, get, () => sshRepository.getConnections(), {
            errorFallback: 'Error fetching SSH connections',
            loadingKey: 'loading',
            onSuccess: (connections) => set({ connections })
        });
    },

    createConnection: async (data) => {
        return await runRequest(set, get, () => sshRepository.createConnection(data), {
            errorFallback: 'Error creating SSH connection',
            rethrow: true,
            loadingKey: 'loading',
            successMessage: 'SSH connection created successfully',
            onSuccess: (created) => {
                set((state: SSHConnectionSlice) => ({
                    connections: [...state.connections, created]
                }));
            }
        });
    },

    updateConnection: async (id, data) => {
        return await runRequest(set, get, () => sshRepository.updateConnection(id, data), {
            errorFallback: 'Error updating SSH connection',
            rethrow: true,
            loadingKey: 'loading',
            successMessage: 'SSH connection updated successfully',
            onSuccess: (updated) => {
                set((state: SSHConnectionSlice) => ({
                    connections: state.connections.map((c) => (c._id === id ? updated : c))
                }));
            }
        });
    },

    deleteConnection: async (id) => {
        await runRequest(set, get, () => sshRepository.deleteConnection(id), {
            errorFallback: 'Error deleting SSH connection',
            rethrow: true,
            loadingKey: 'loading',
            successMessage: 'SSH connection deleted successfully',
            onSuccess: () => {
                set((state: SSHConnectionSlice) => ({
                    connections: state.connections.filter((c) => c._id !== id)
                }));
            }
        });
    },

    testConnection: async (id) => {
        try {
            return await sshRepository.testConnection(id);
        } catch (error: any) {
            return { valid: false, error: error.message || 'Error testing SSH connection' };
        }
    }
});
