export const confirm = (message: string): boolean => window.confirm(message);

export const confirmDelete = (itemName: string, customMessage?: string): boolean => {
    const message = customMessage || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
    return window.confirm(message);
};