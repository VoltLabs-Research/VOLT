import systemApi from '@/services/api/system/system';
import type { RBACResource, RBACAction } from '@/services/api/system/types';
import { runRequest } from '@/stores/helpers';
import type { SliceCreator } from '@/stores/helpers';

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

export const initialState: RBACState = {
    resources: [],
    actions: [],
    isLoading: false,
    error: null
};

export const createRBACSlice: SliceCreator<RBACSlice> = (set, get) => {
    return {
        ...initialState,

        fetchRBACConfig: async () => {
            await runRequest(set, get, () => systemApi.getRBACConfig(), {
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
    };
};
