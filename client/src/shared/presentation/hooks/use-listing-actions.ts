import { confirm, confirmDelete } from './use-confirm';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useCallback } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import type { MenuOption } from '@/shared/presentation/types/menu';

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

export interface ActionConfig<T = unknown> {
    label?: string;
    icon?: IconType;
    handler: (payload: { item: T; selectedItems: T[] }) => void | Promise<void>;
    confirm?: boolean | string | ((payload: { item: T; selectedItems: T[] }) => string);
    variant?: 'default' | 'danger';
    scope?: 'item' | 'selection';
    requiredPermission?: string;
};

export interface UseListingActionsConfig<T = unknown> {
    actions: Record<string, ActionConfig<T>>;
};

export interface UseListingActionsReturn<T = unknown> {
    handleAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
    getMenuOptions: (item: T, selectedItems: T[]) => MenuOption[];
    executeAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
    getSelectionActionOptions: (item: T, selectedItems: T[]) => MenuOption[];
};

const ICON_PRESETS_REACT_ICONS: Record<string, IconType> = {
    delete: RiDeleteBin6Line,
    edit: RiEditLine,
    view: RiEyeLine
};

const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const getItemId = (item: unknown): string | undefined => {
    if (typeof item !== 'object' || item === null || !('_id' in item)) {
        return undefined;
    }

    const itemId = item._id;
    if (typeof itemId !== 'string' || itemId.length === 0) {
        return undefined;
    }

    return itemId;
};

const useListingActions = <T = unknown>(config: UseListingActionsConfig<T>): UseListingActionsReturn<T> => {
    const { actions } = config;

    const { canAccess } = useTeamPermissions();

    const hasPermission = useCallback((permission?: string): boolean => {
        if(!permission) return true;
        return canAccess([permission]);
    }, [canAccess]);
    
    const getActionIcon = useCallback((actionKey: string, actionConfig: ActionConfig<T>): IconType | null => {
        if(actionConfig.icon) return actionConfig.icon;
        return ICON_PRESETS_REACT_ICONS[actionKey] || null;
    }, []);

    const getActionLabel = useCallback((actionKey: string, actionConfig: ActionConfig<T>): string => {
        if(actionConfig.label) return actionConfig.label;
        return capitalize(actionKey);
    }, []);

    const getActionScope = useCallback((actionKey: string, actionConfig: ActionConfig<T>): 'item' | 'selection' => {
        if(actionConfig.scope){
            return actionConfig.scope;
        }

        if(actionConfig.variant === 'danger' || actionKey === 'delete'){
            return 'selection';
        }

        return 'item';
    }, []);

    const getActionTargets = useCallback((item: T, selectedItems: T[], scope: 'item' | 'selection'): T[] => {
        if(scope === 'item'){
            return [item];
        }

        if(!selectedItems.length){
            return [item];
        }

        const currentItemId = getItemId(item);
        const hasMatchingSelection = selectedItems.some((selectedItem) => getItemId(selectedItem) === currentItemId);

        if(currentItemId && hasMatchingSelection){
            return selectedItems;
        }

        return [item];
    }, []);

    const shouldConfirm = useCallback(async (actionConfig: ActionConfig<T>, item: T, selectedItems: T[]): Promise<boolean> => {
        if(!actionConfig.confirm) return true;

        if(typeof actionConfig.confirm === 'boolean'){
            if(selectedItems.length > 1){
                return await confirmDelete(`${selectedItems.length} selected items`);
            }

            let itemName = 'this item';
            if (
                typeof item === 'object'
                && item !== null
                && 'name' in item
                && typeof item.name === 'string'
                && item.name.length > 0
            ) {
                itemName = item.name;
            }

            return await confirmDelete(itemName);
        }

        if(typeof actionConfig.confirm === 'string'){
            return await confirm(actionConfig.confirm);
        }

        if(typeof actionConfig.confirm === 'function'){
            const message = actionConfig.confirm({ item, selectedItems });
            return await confirm(message);
        }

        return true;
    }, []);

    const executeAction = useCallback(async (actionKey: string, item: T, selectedItems: T[]): Promise<void> => {
        const actionConfig = actions[actionKey];
        if(!actionConfig) return;
        if(!hasPermission(actionConfig.requiredPermission)) return;

        const scope = getActionScope(actionKey, actionConfig);
        const targets = getActionTargets(item, selectedItems, scope);
        const primaryItem = targets[0] ?? item;

        const isConfirmed = await shouldConfirm(actionConfig, primaryItem, targets);
        if(!isConfirmed) return;

        try{
            if(scope === 'selection'){
                for(const currentItem of targets){
                    await actionConfig.handler({ item: currentItem, selectedItems: targets });
                }
                return;
            }

            await actionConfig.handler({ item: primaryItem, selectedItems: targets });
        }catch(err){
            throw err;
        }
    }, [actions, hasPermission, shouldConfirm, getActionScope, getActionTargets]);

    const handleAction = executeAction;

    const getMenuOptions = useCallback((item: T, selectedItems: T[]): MenuOption[] => {
        const actionEntries = Object.entries(actions);

        return actionEntries
            .filter(([, actionConfig]) => hasPermission(actionConfig.requiredPermission))
            .map(([actionKey, actionConfig]) => {
                const label = getActionLabel(actionKey, actionConfig);
                const icon = getActionIcon(actionKey, actionConfig);
                const onClick = () => executeAction(actionKey, item, selectedItems);
                const destructive = actionConfig.variant === 'danger' || actionKey === 'delete';

                return {
                    label,
                    icon: icon || undefined,
                    onClick,
                    destructive
                };
            });
    }, [actions, hasPermission, getActionLabel, getActionIcon, executeAction]);

    const getSelectionActionOptions = useCallback((item: T, selectedItems: T[]): MenuOption[] => {
        if (selectedItems.length <= 1) {
            return getMenuOptions(item, selectedItems);
        }

        return getMenuOptions(item, selectedItems).filter((option) => option.destructive);
    }, [getMenuOptions]);

    return {
        handleAction,
        getMenuOptions,
        executeAction,
        getSelectionActionOptions
    };
};

export default useListingActions;
