import { useCallback } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { confirm, confirmDelete } from './use-confirm';
import type { MenuOption } from '../components/DocumentListingTable';

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

export interface ActionConfig<T = unknown> {
    label?: string;
    icon?: IconType;
    handler: (payload: { item: T; selectedItems: T[] }) => void | Promise<void>;
    confirm?: boolean | string | ((payload: { item: T; selectedItems: T[] }) => string);
    variant?: 'default' | 'danger';
    scope?: 'item' | 'selection';
};

export interface UseListingActionsConfig<T = unknown> {
    actions: Record<string, ActionConfig<T>>;
};

export interface UseListingActionsReturn<T = unknown> {
    handleAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
    getMenuOptions: (item: T, selectedItems: T[]) => MenuOption[];
    executeAction: (actionKey: string, item: T, selectedItems: T[]) => Promise<void>;
};

const ICON_PRESETS_REACT_ICONS: Record<string, IconType> = {
    delete: RiDeleteBin6Line,
    edit: RiEditLine,
    view: RiEyeLine
};

const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const useListingActions = <T = unknown>(config: UseListingActionsConfig<T>): UseListingActionsReturn<T> => {
    const { actions } = config;
    
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

        if(selectedItems.includes(item)){
            return selectedItems;
        }

        return [item];
    }, []);

    const shouldConfirm = useCallback((actionConfig: ActionConfig<T>, item: T, selectedItems: T[]): boolean => {
        if(!actionConfig.confirm) return true;

        if(typeof actionConfig.confirm === 'boolean'){
            if(selectedItems.length > 1){
                return confirmDelete(`${selectedItems.length} selected items`);
            }

            const itemName = (item as Record<string, unknown>)?.name as string || 'this item';
            return confirmDelete(itemName);
        }

        if(typeof actionConfig.confirm === 'string'){
            return confirm(actionConfig.confirm);
        }

        if(typeof actionConfig.confirm === 'function'){
            const message = actionConfig.confirm({ item, selectedItems });
            return confirm(message);
        }

        return true;
    }, []);

    const executeAction = useCallback(async (actionKey: string, item: T, selectedItems: T[]): Promise<void> => {
        const actionConfig = actions[actionKey];
        if(!actionConfig){
            console.warn(`Action "${actionKey}" not found in actions config`);
            return;
        }

        const scope = getActionScope(actionKey, actionConfig);
        const targets = getActionTargets(item, selectedItems, scope);
        const primaryItem = targets[0] ?? item;

        if(!shouldConfirm(actionConfig, primaryItem, targets)) return;

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
    }, [actions, shouldConfirm, getActionScope, getActionTargets]);

    const handleAction = executeAction;

    const getMenuOptions = useCallback((item: T, selectedItems: T[]): MenuOption[] => {
        const actionEntries = selectedItems.length > 1
            ? Object.entries(actions).filter(([actionKey]) => actionKey === 'delete')
            : Object.entries(actions);

        return actionEntries.map(([actionKey, actionConfig]) => {
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
    }, [actions, getActionLabel, getActionIcon, executeAction]);

    return {
        handleAction,
        getMenuOptions,
        executeAction
    };
};

export default useListingActions;
