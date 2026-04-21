import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../utilities/format-key-name';

import { Fragment } from 'react';
import './ShortcutFeedback.css';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <div className="volt-container canvas-shortcut-feedback center-x glass-bg d-flex items-center gap-05 p-fixed">
            <div className="volt-container canvas-shortcut-feedback-keys d-flex items-center gap-025">
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <span className="font-size-1 color-secondary">+</span>}
                        <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                    </Fragment>
                ))}
            </div>
            <span className="font-size-1 color-secondary">{lastTriggered.description}</span>
        </div>
    );
};

export default ShortcutFeedback;
