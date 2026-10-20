import { useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface ShortcutOptions {
    ctrl?: boolean;
    meta?: boolean;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
    preventDefault?: boolean;
    enabled?: boolean;
    enableOnFormTags?: boolean;
};

export const useKeyboardShortcut = (
    key: string | string[],
    callback: () => void,
    options: ShortcutOptions = {}
) => {
    const {
        ctrl = false,
        meta = false,
        mod = false,
        shift = false,
        alt = false,
        preventDefault = true,
        enabled = true,
        enableOnFormTags = false
    } = options;

    const hotkey = useMemo(() => {
        const modifiers: string[] = [];

        if (mod) modifiers.push('mod');
        if (ctrl) modifiers.push('ctrl');
        if (meta) modifiers.push('meta');
        if (shift) modifiers.push('shift');
        if (alt) modifiers.push('alt');

        const keys = Array.isArray(key) ? key : [key];

        return keys
            .map((single) => [...modifiers, single.toLowerCase()].join('+'))
            .join(',');
    }, [alt, ctrl, key, meta, mod, shift]);

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

