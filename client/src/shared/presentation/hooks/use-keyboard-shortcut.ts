import { useCallback, useEffect } from 'react';

interface ShortcutOptions {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    preventDefault?: boolean;
};

/**
 * Hook for handling keyboard shortcuts.
 * 
 * @param key - The key to listen for (e.g., 's', 'Enter', 'Escape')
 * @param callback - Function to execute when the shortcut is triggered
 * @param options - Modifier keys and behavior options
 */
const useKeyboardShortcut = (
    key: string,
    callback: () => void,
    options: ShortcutOptions = {}
) => {
    const {
        ctrl = false,
        meta = false,
        shift = false,
        alt = false,
        preventDefault = true
    } = options;

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const isCtrlMatch = ctrl ? (event.ctrlKey || event.metaKey) : true;
        const isMetaMatch = meta ? event.metaKey : true;
        const isShiftMatch = shift ? event.shiftKey : !event.shiftKey;
        const isAltMatch = alt ? event.altKey : !event.altKey;
        const isKeyMatch = event.key.toLowerCase() === key.toLowerCase();

        if(isKeyMatch && isCtrlMatch && isMetaMatch && isShiftMatch && isAltMatch){
            if(preventDefault){
                event.preventDefault();
            }
            callback();
        }
    }, [key, callback, ctrl, meta, shift, alt, preventDefault]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

export default useKeyboardShortcut;
