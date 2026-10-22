// A landing screen keeps nothing: the app it renders reads and writes storage as it does
// in the app, against stores of the screen's own that empty when it closes, never against
// the visitor's (their theme, their team, their drafts, a message waiting to be sent).
const createMemoryStorage = (): Storage => {
    const items = new Map<string, string>();

    return {
        get length() {
            return items.size;
        },
        clear: () => items.clear(),
        getItem: (key) => items.get(key) ?? null,
        key: (index) => [...items.keys()][index] ?? null,
        removeItem: (key) => {
            items.delete(key);
        },
        setItem: (key, value) => {
            items.set(key, String(value));
        }
    };
};

const refuseFiles = () => Promise.reject(new DOMException('A landing screen keeps no files.', 'SecurityError'));

export const isolateScreenStorage = (): void => {
    for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, { configurable: true, value: createMemoryStorage() });
    }

    // Nor the origin's file system, where the viewer caches the models it loads.
    if (navigator.storage) {
        Object.defineProperty(navigator.storage, 'getDirectory', { configurable: true, value: refuseFiles });
    }
};
