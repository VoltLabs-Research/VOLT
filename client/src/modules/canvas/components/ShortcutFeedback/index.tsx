import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import formatKeyName from '../../utils/format-key-name';

import { Fragment } from 'react';
import './ShortcutFeedback.css';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <div className='bg-surface border border-border flex items-center gap-2 fixed canvas-shortcut-feedback center-x'>
            <div className='flex flex-row items-center gap-1 canvas-shortcut-feedback-keys'>
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <span className='text-xs text-muted'>+</span>}
                        <kbd className="canvas-shortcut-key text-xs">{formatKeyName(key)}</kbd>
                    </Fragment>
                ))}
            </div>
            <span className='text-xs text-muted'>{lastTriggered.description}</span>
        </div>
    );
};

export default ShortcutFeedback;
