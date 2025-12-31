import sshApi from '@/services/api/ssh/ssh';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';
import type { CreateSSHConnectionPayload } from '@/services/api/ssh/types';

export interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateSSHConnectionData {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
}

export interface SSHConnectionState {
    connections: SSHConnection[];
    loading: boolean;
    error: string | null;
}

export interface SSHConnectionActions {
    fetchConnections: () => Promise<void>;
    createConnection: (data: CreateSSHConnectionPayload) => Promise<SSHConnection | null>;
    updateConnection: (id: string, data: UpdateSSHConnectionData) => Promise<SSHConnection | null>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (id: string) => Promise<{ valid: boolean; error?: string }>;
}

export type SSHConnectionSlice = SSHConnectionState & SSHConnectionActions;

export const initialState: SSHConnectionState = {
    connections: [],
    loading: true,
    error: null
};

const ERROR_MESSAGES = {
    FETCH: 'Error fetching SSH connections',
    CREATE: 'Error creating SSH connection',
    UPDATE: 'Error updating SSH connection',
    DELETE: 'Error deleting SSH connection',
    TEST: 'Error testing SSH connection'
} as const;

const replaceConnectionById = (
    connections: SSHConnection[],
    id: string,
    updated: SSHConnection
): SSHConnection[] => {
    return connections.map((conn) => (conn._id === id ? updated : conn));
};

const removeConnectionById = (connections: SSHConnection[], id: string): SSHConnection[] => {
    return connections.filter((conn) => conn._id !== id);
};

const appendConnection = (connections: SSHConnection[], conn: SSHConnection): SSHConnection[] => {
    return [...connections, conn];
};

const toTestErrorMessage = (error: unknown): string => {
    const anyError = error as any;
    const apiMessage = anyError?.response?.data?.data?.error;
    const fallback = anyError?.message;
    return apiMessage || fallback || ERROR_MESSAGES.TEST;
};

export const createSSHConnectionSlice: SliceCreator<SSHConnectionSlice> = (set, get) => {
    const fetchConnections = async (): Promise<void> => {
        const request = () => sshApi.connections.getAll();

        await runRequest(set, get, request, {
            errorFallback: ERROR_MESSAGES.FETCH,
            loadingKey: 'loading',
            onSuccess: (connections: SSHConnection[]) => {
                set({ connections } as Partial<SSHConnectionSlice>);
            }
        });
    };

    const createConnection = async (
        data: CreateSSHConnectionPayload
    ): Promise<SSHConnection | null> => {
        const request = () => sshApi.connections.create(data);

        return await runRequest(set, get, request, {
            errorFallback: ERROR_MESSAGES.CREATE,
            rethrow: true,
            loadingKey: 'loading',
            onSuccess: (created: SSHConnection) => {
                set((state: SSHConnectionSlice) => ({
                    connections: appendConnection(state.connections, created)
                }));
            }
        });
    };

    const updateConnection = async (
        id: string,
        data: UpdateSSHConnectionData
    ): Promise<SSHConnection | null> => {
        const request = () => sshApi.connections.update(id, data);

        return await runRequest(set, get, request, {
            errorFallback: ERROR_MESSAGES.UPDATE,
            rethrow: true,
            loadingKey: 'loading',
            onSuccess: (updated: SSHConnection) => {
                set((state: SSHConnectionSlice) => ({
                    connections: replaceConnectionById(state.connections, id, updated)
                }));
            }
        });
    };

    const deleteConnection = async (id: string): Promise<void> => {
        const request = () => sshApi.connections.delete(id);

        await runRequest(set, get, request, {
            errorFallback: ERROR_MESSAGES.DELETE,
            rethrow: true,
            loadingKey: 'loading',
            onSuccess: () => {
                set((state: SSHConnectionSlice) => ({
                    connections: removeConnectionById(state.connections, id)
                }));
            }
        });
    };

    const testConnection = async (
        id: string
    ): Promise<{ valid: boolean; error?: string }> => {
        try {
            const result = await sshApi.connections.test(id);
            return result;
        } catch (error: unknown) {
            return { valid: false, error: toTestErrorMessage(error) };
        }
    };

    return {
        ...initialState,
        fetchConnections,
        createConnection,
        updateConnection,
        deleteConnection,
        testConnection
    };
};
