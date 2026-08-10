import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import formatKeyName from '../../utils/format-key-name';

import { Fragment } from 'react';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <div className='center-x fixed bottom-28 z-[1001] flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5'>
            <div className='flex flex-row items-center gap-1'>
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <span className='text-xs text-muted'>+</span>}
                        <kbd className='inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-surface-tertiary text-xs'>
                            {formatKeyName(key)}
                        </kbd>
                    </Fragment>
                ))}
            </div>
            <span className='text-xs text-muted'>{lastTriggered.description}</span>
        </div>
    );
};

export default ShortcutFeedback;
