import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../utilities/format-key-name';

import { Fragment } from 'react';
import { Row, Surface, Text } from '@voltstack/bravais';
import './ShortcutFeedback.css';

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    if (!lastTriggered || !shortcut) return null;

    return (
        <Surface variant='glass' display='flex' align='center' gap='05' position='fixed' className="canvas-shortcut-feedback center-x">
            <Row gap='025' className="canvas-shortcut-feedback-keys">
                {shortcut.keys.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && <Text size='sm' tone='secondary'>+</Text>}
                        <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                    </Fragment>
                ))}
            </Row>
            <Text size='sm' tone='secondary'>{lastTriggered.description}</Text>
        </Surface>
    );
};

export default ShortcutFeedback;
