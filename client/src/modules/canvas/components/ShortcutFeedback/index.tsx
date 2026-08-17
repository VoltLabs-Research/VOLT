import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import formatKeyName from '../../utils/format-key-name';
import { Kbd } from '@heroui/react';

import { Fragment } from 'react';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <div className='popover center-x fixed bottom-28 z-[1001] flex items-center gap-2 px-2.5 py-1.5'>
            <div className='flex flex-row items-center gap-1'>
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <span className='text-xs text-muted'>+</span>}
                        <Kbd className='text-xs'>{formatKeyName(key)}</Kbd>
                    </Fragment>
                ))}
            </div>
            <span className='text-xs text-muted'>{lastTriggered.description}</span>
        </div>
    );
};

export default ShortcutFeedback;
