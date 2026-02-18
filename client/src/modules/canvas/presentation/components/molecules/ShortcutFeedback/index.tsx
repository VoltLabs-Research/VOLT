import { Fragment } from 'react';
import Container from '@/shared/presentation/components/Container';
import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../../utils/format-key-name';
import './ShortcutFeedback.css';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <Container className="canvas-shortcut-feedback center-x glass-bg d-flex items-center gap-05 p-fixed">
            <Container className="canvas-shortcut-feedback-keys d-flex items-center gap-025">
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <span className="font-size-1 color-secondary">+</span>}
                        <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                    </Fragment>
                ))}
            </Container>
            <span className="font-size-1 color-secondary">{lastTriggered.description}</span>
        </Container>
    );
};

export default ShortcutFeedback;
