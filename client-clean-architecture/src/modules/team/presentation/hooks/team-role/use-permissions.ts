import { useState, useCallback } from 'react';

export interface RBACAction{
    key: string;
    label: string;
};

export interface UsePermissionsOptions{
    initialPermissions?: string[];
    actions: RBACAction[];
    disabled?: boolean;
};

export interface UsePermissionsReturn{
    permissions: Set<string>;
    setPermissions: (permissions: Set<string>) => void;
    resetPermissions: (permissions?: string[]) => void;
    getPermission: (resourceKey: string, actionKey: string) => string;
    hasPermission: (resourceKey: string, actionKey: string) => boolean;
    togglePermission: (resourceKey: string, actionKey: string) => void;
    toggleResourceAll: (resourceKey: string) => void;
    toArray: () => string[];
};

export const getPermission = (resourceKey: string, actionKey: string): string => {
    return `${resourceKey}:${actionKey}`;
};

export const checkPermission = (
    permissions: Set<string>,
    resourceKey: string,
    actionKey: string
): boolean => {
    const permission = getPermission(resourceKey, actionKey);
    if(permissions.has('*')) return true;
    if(permissions.has(permission)) return true;
    if(permissions.has(`${resourceKey}:*`)) return true;
    if(permissions.has(`*:${actionKey}`)) return true;
    return false;
};

const usePermissions = ({
    initialPermissions = [],
    actions,
    disabled = false
}: UsePermissionsOptions): UsePermissionsReturn => {
    const [permissions, setPermissions] = useState<Set<string>>(() => new Set(initialPermissions));

    const resetPermissions = useCallback((newPermissions: string[] = []) => {
        setPermissions(new Set(newPermissions));
    }, []);

    const hasPermission = useCallback((resourceKey: string, actionKey: string): boolean => {
        return checkPermission(permissions, resourceKey, actionKey);
    }, [permissions]);

    const togglePermission = useCallback((resourceKey: string, actionKey: string) => {
        if(disabled) return;

        const permission = getPermission(resourceKey, actionKey);
        setPermissions((prev) => {
            const next = new Set(prev);
            if(next.has(permission)){
                next.delete(permission);
            }else{
                next.add(permission);
            }
            return next;
        });
    }, [disabled]);

    const toggleResourceAll = useCallback((resourceKey: string) => {
        if(disabled) return;

        const resourcePermissions = actions.map((action) => getPermission(resourceKey, action.key));
        const allChecked = resourcePermissions.every((permission) => permissions.has(permission));

        setPermissions((prev) => {
            const next = new Set(prev);
            if(allChecked){
                resourcePermissions.forEach((permission) => next.delete(permission));
            }else{
                resourcePermissions.forEach((permission) => next.add(permission));
            }
            return next;
        });
    }, [disabled, permissions, actions]);

    const toArray = useCallback((): string[] => {
        return Array.from(permissions);
    }, [permissions]);

    return {
        permissions,
        setPermissions,
        resetPermissions,
        getPermission,
        hasPermission,
        togglePermission,
        toggleResourceAll,
        toArray
    };
};

export default usePermissions;
