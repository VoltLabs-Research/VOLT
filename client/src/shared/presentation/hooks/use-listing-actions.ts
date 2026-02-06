import { useCallback } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { confirm, confirmDelete } from './use-confirm';
import type { MenuOption } from '../components/DocumentListingTable';

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

export interface ActionConfig<T = unknown> {
    label?: string;
    icon?: IconType;
    handler: (item: T) => void | Promise<void>;
    confirm?: boolean | string | ((item: T) => string);
    variant?: 'default' | 'danger';
};

export interface UseListingActionsConfig<T = unknown> {
    actions: Record<string, ActionConfig<T>>;
};

export interface UseListingActionsReturn<T = unknown> {
    handleAction: (actionKey: string, item: T) => Promise<void>;
    getMenuOptions: (item: T) => MenuOption[];
    executeAction: (actionKey: string, item: T) => Promise<void>;
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

    const shouldConfirm = useCallback((actionConfig: ActionConfig<T>, item: T): boolean => {
        if(!actionConfig.confirm) return true;

        if(typeof actionConfig.confirm === 'boolean'){
            const itemName = (item as Record<string, unknown>)?.name as string || 'this item';
            return confirmDelete(itemName);
        }

        if(typeof actionConfig.confirm === 'string'){
            return confirm(actionConfig.confirm);
        }

        if(typeof actionConfig.confirm === 'function'){
            const message = actionConfig.confirm(item);
            return confirm(message);
        }

        return true;
    }, []);

    const executeAction = useCallback(async (actionKey: string, item: T): Promise<void> => {
        const actionConfig = actions[actionKey];
        if(!actionConfig){
            console.warn(`Action "${actionKey}" not found in actions config`);
            return;
        }

        if(!shouldConfirm(actionConfig, item)) return;

        try{
            await actionConfig.handler(item);
        }catch(err){
            console.error(`Failed to execute action "${actionKey}":`, err);
            throw err;
        }
    }, [actions, shouldConfirm]);

    const handleAction = executeAction;

    const getMenuOptions = useCallback((item: T): MenuOption[] => {
        return Object.entries(actions).map(([actionKey, actionConfig]) => {
            const label = getActionLabel(actionKey, actionConfig);
            const icon = getActionIcon(actionKey, actionConfig);
            const onClick = () => executeAction(actionKey, item);
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