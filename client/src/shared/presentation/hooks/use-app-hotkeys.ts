import { useHotkeys } from 'react-hotkeys-hook';
import type { Options } from 'react-hotkeys-hook';

interface AppHotkeyOptions extends Omit<Options, 'enabled'> {
    enabled?: boolean;
    enableOnFormTags?: boolean;
};

const useAppHotkeys = <T extends HTMLElement = HTMLElement>(
    keys: string,
    callback: (event: KeyboardEvent) => void,
    options: AppHotkeyOptions = {},
    dependencies: ReadonlyArray<unknown> = []
): React.RefObject<T | null> => {
    const {
        enabled = true,
        enableOnFormTags = false,
        ...restOptions
    } = options;

    return useHotkeys<T>(
        keys,
        (event) => {
            callback(event);
        },
        {
            enabled,
            enableOnFormTags: enableOnFormTags
                ? ['INPUT', 'TEXTAREA', 'SELECT']
                : false,
            ...restOptions
        },
        dependencies
    );
};

export default useAppHotkeys;
