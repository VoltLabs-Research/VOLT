export const readStoredString = (key: string): string | null => {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeStoredString = (key: string, value: string): void => {
    try {
        window.localStorage.setItem(key, value);
    } catch {
    }
};

export const removeStoredValue = (key: string): void => {
    try {
        window.localStorage.removeItem(key);
    } catch {
    }
};
