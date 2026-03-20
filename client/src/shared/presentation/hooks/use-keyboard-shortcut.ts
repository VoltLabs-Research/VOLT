import { useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface ShortcutOptions {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    preventDefault?: boolean;
    enabled?: boolean;
    enableOnFormTags?: boolean;
};

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
        preventDefault = true,
        enabled = true,
        enableOnFormTags = false
    } = options;

    const hotkey = useMemo(() => {
        const parts: string[] = [];

        if (ctrl) parts.push('ctrl');
        if (meta) parts.push('meta');
        if (shift) parts.push('shift');
        if (alt) parts.push('alt');

        parts.push(key.toLowerCase());

        return parts.join('+');
    }, [alt, ctrl, key, meta, shift]);

    useHotkeys(
        hotkey,
        () => callback(),
        {
            enabled,
            enableOnFormTags: enableOnFormTags
                ? ['INPUT', 'TEXTAREA', 'SELECT']
                : false,
            preventDefault
        },
        [callback]
    );
};

export default useKeyboardShortcut;
