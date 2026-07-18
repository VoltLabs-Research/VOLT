
const PROTECTED_MODULE_KEYS = ['dashboard', 'trajectory'] as const;

const PROTECTED_MODULE_KEY_SET = new Set<string>(PROTECTED_MODULE_KEYS);

export const isHideableModule = (moduleKey: string | undefined): moduleKey is string => {
    return Boolean(moduleKey) && !PROTECTED_MODULE_KEY_SET.has(moduleKey as string);
};
