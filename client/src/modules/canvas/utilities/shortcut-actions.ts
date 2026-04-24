type ShortcutAction = () => void;

const actions = new Map<string, ShortcutAction>();

export const registerShortcutAction = (id: string, action: ShortcutAction): void => {
    actions.set(id, action);
};

export const clearShortcutActions = (): void => {
    actions.clear();
};

export const triggerShortcutAction = (id: string): boolean => {
    const action = actions.get(id);
    if (!action) return false;
    action();
    return true;
};
