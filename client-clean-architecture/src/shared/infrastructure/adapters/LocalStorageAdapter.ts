/**
 * Storage adapter interface.
 */
export interface IStorageAdapter {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    clear(): void;
}

/**
 * Browser localStorage adapter.
 * Encapsulates localStorage operations.
 */
export class LocalStorageAdapter implements IStorageAdapter {
    /**
     * Gets a value from localStorage.
     */
    get(key: string): string | null {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(key);
    }

    /**
     * Sets a value in localStorage.
     */
    set(key: string, value: string): void {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(key, value);
    }

    /**
     * Removes a value from localStorage.
     */
    remove(key: string): void {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(key);
    }

    /**
     * Clears all localStorage.
     */
    clear(): void {
        if (typeof localStorage === 'undefined') return;
        localStorage.clear();
    }

    /**
     * Gets a JSON value from localStorage.
     */
    getJson<T>(key: string): T | null {
        const value = this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    /**
     * Sets a JSON value in localStorage.
     */
    setJson<T>(key: string, value: T): void {
        this.set(key, JSON.stringify(value));
    }
}

/**
 * Browser sessionStorage adapter.
 */
export class SessionStorageAdapter implements IStorageAdapter {
    get(key: string): string | null {
        if (typeof sessionStorage === 'undefined') return null;
        return sessionStorage.getItem(key);
    }

    set(key: string, value: string): void {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.setItem(key, value);
    }

    remove(key: string): void {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.removeItem(key);
    }

    clear(): void {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.clear();
    }
}
