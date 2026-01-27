import VoltClient from '@/shared/infrastructure/api';
import type { ApiResponse } from '@/shared/types/api';
import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';

export interface RBACResource {
    key: string;
    label: string;
}

export interface RBACAction {
    key: string;
    label: string;
}

export interface RBACConfig {
    resources: RBACResource[];
    actions: RBACAction[];
}

export interface RBACState {
    resources: RBACResource[];
    actions: RBACAction[];
    isLoading: boolean;
    error: string | null;
}

export interface RBACActions {
    fetchRBACConfig: () => Promise<void>;
    getPermission: (resource: string, action: string) => string;
    hasPermission: (permissions: string[], resource: string, action: string) => boolean;
    parsePermission: (permission: string) => { resource: string; action: string } | null;
}

export type RBACSlice = RBACState & RBACActions;

const client = new VoltClient('/system');

export const initialState: RBACState = {
    resources: [],
    actions: [],
    isLoading: false,
    error: null
};

export const createRBACSlice: SliceCreator<RBACSlice> = (set, get) => ({
    ...initialState,

    fetchRBACConfig: async () => {
        const state = get() as RBACSlice;
        if (state.resources.length > 0) return;

        await runRequest(set, get, async () => {
            const response = await client.request<ApiResponse<RBACConfig>>('get', '/rbac');
            return response.data.data;
        }, {
            onSuccess: (config) => set({
                resources: config.resources,
                actions: config.actions,
                error: null
            }),
            loadingKey: 'isLoading',
            errorFallback: 'Failed to load RBAC configuration'
        });
    },

    getPermission: (resource: string, action: string): string => {
        return `${resource}:${action}`;
    },

    hasPermission: (permissions: string[], resource: string, action: string): boolean => {
        if (permissions.includes('*')) return true;
        const { getPermission } = get();
        return permissions.includes(getPermission(resource, action));
    },

    parsePermission: (permission: string): { resource: string; action: string } | null => {
        const parts = permission.split(':');
        if (parts.length !== 2) return null;
        return { resource: parts[0], action: parts[1] };
    }
});
