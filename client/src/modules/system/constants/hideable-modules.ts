const PROTECTED_MODULE_KEYS = new Set(['dashboard', 'trajectory']);

export const isHideableModule = (moduleKey: string | undefined): moduleKey is string => {
    return !!moduleKey && !PROTECTED_MODULE_KEYS.has(moduleKey);
};
