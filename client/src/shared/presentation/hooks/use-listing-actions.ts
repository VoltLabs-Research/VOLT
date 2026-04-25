import { confirm, confirmDelete } from './use-confirm';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useCallback } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import type { ComponentType } from 'react';
import type { MenuIconProps, MenuOption } from '@/shared/presentation/types/menu';

interface ActionConfig<T = unknown> {
    label?: string;
    icon?: ComponentType<MenuIconProps>;
    handler: (payload: { item: T; selectedItems: T[] }) => void | Promise<void>;
    confirm?: boolean | string | ((payload: { item: T; selectedItems: T[] }) => string);
    variant?: 'default' | 'danger';
    scope?: 'item' | 'selection';
    requiredPermission?: string;
};

interface UseListingActionsConfig<T = unknown> {
    actions: Record<string, ActionConfig<T>>;
};

interface UseListingActionsReturn<T = unknown> {
    handleAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
    getMenuOptions: (item: T, selectedItems: T[]) => MenuOption[];
    executeAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
    getSelectionActionOptions: (item: T, selectedItems: T[]) => MenuOption[];
};

const ICON_PRESETS_REACT_ICONS: Record<string, ComponentType<MenuIconProps>> = {
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

const getActionIcon = <T,>(actionKey: string, actionConfig: ActionConfig<T>): ComponentType<MenuIconProps> | null => {
    return actionConfig.icon ?? ICON_PRESETS_REACT_ICONS[actionKey] ?? null;
};

const getActionLabel = <T,>(actionKey: string, actionConfig: ActionConfig<T>): string => {
    return actionConfig.label ?? capitalize(actionKey);
};

const getActionScope = <T,>(actionKey: string, actionConfig: ActionConfig<T>): 'item' | 'selection' => {
    if (actionConfig.scope) {
        return actionConfig.scope;
    }

    return actionConfig.variant === 'danger' || actionKey === 'delete' ? 'selection' : 'item';
};

const getActionTargets = <T,>(item: T, selectedItems: T[], scope: 'item' | 'selection'): T[] => {
    if (scope === 'item' || !selectedItems.length) {
        return [item];
    }

    const currentItemId = getItemId(item);
    const hasMatchingSelection = selectedItems.some((selectedItem) => getItemId(selectedItem) === currentItemId);

    return currentItemId && hasMatchingSelection ? selectedItems : [item];
};

const getConfirmItemName = (item: unknown): string => {
    if (
        typeof item === 'object'
        && item !== null
        && 'name' in item
        && typeof item.name === 'string'
        && item.name.length > 0
    ) {
        return item.name;
    }

    return 'this item';
};

const shouldConfirm = async <T,>(actionConfig: ActionConfig<T>, item: T, selectedItems: T[]): Promise<boolean> => {
    if (!actionConfig.confirm) {
        return true;
    }

    if (typeof actionConfig.confirm === 'boolean') {
        return selectedItems.length > 1
            ? confirmDelete(`${selectedItems.length} selected items`)
            : confirmDelete(getConfirmItemName(item));
    }

    if (typeof actionConfig.confirm === 'string') {
        return confirm(actionConfig.confirm);
    }

    const message = actionConfig.confirm({ item, selectedItems });
    return confirm(message);
};

const useListingActions = <T = unknown>(config: UseListingActionsConfig<T>): UseListingActionsReturn<T> => {
    const { actions } = config;

    const { canAccess } = useTeamPermissions();

    const hasPermission = useCallback((permission?: string): boolean => {
        return !permission || canAccess([permission]);
    }, [canAccess]);

    const executeAction = useCallback(async (actionKey: string, item: T, selectedItems: T[]): Promise<void> => {
        const actionConfig = actions[actionKey];
        if (!actionConfig || !hasPermission(actionConfig.requiredPermission)) {
            return;
        }

        const scope = getActionScope(actionKey, actionConfig);
        const targets = getActionTargets(item, selectedItems, scope);
        const primaryItem = targets[0] ?? item;

        const isConfirmed = await shouldConfirm(actionConfig, primaryItem, targets);
        if (!isConfirmed) {
            return;
        }

        if (scope === 'selection') {
            for (const currentItem of targets) {
                await actionConfig.handler({ item: currentItem, selectedItems: targets });
            }
            return;
        }
        await actionConfig.handler({ item: primaryItem, selectedItems: targets });
    }, [actions, hasPermission]);

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
    }, [actions, hasPermission, executeAction]);

    const getSelectionActionOptions = useCallback((item: T, selectedItems: T[]): MenuOption[] => {
        if (selectedItems.length <= 1) {
            return getMenuOptions(item, selectedItems);
        }

        return getMenuOptions(item, selectedItems).filter((option) => option.destructive);
    }, [getMenuOptions]);

    return {
        handleAction: executeAction,
        getMenuOptions,
        executeAction,
        getSelectionActionOptions
    };
};

export default useListingActions;
