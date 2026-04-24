import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../utilities/format-key-name';

import Heading from '@/shared/presentation/primitives/Heading';
import Modal, { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { useMemo, useEffect } from 'react';
import type { Shortcut } from '../../stores/use-keyboard-shortcuts-store';

import './KeyboardShortcutsPanel.css';

const CATEGORY_ORDER = ['playback', 'view', 'navigation', 'general'];
const MODAL_ID = 'canvas-shortcuts-modal';

const KeyboardShortcutsPanel = () => {
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const getShortcutsByCategory = useKeyboardShortcutsStore((s) => s.getShortcutsByCategory);

    const groupedShortcuts = useMemo(() => {
        const groups = getShortcutsByCategory();
        return CATEGORY_ORDER
            .filter((cat) => groups[cat]?.length > 0)
            .map((cat) => ({ category: cat, shortcuts: groups[cat] }));
    }, [getShortcutsByCategory]);

    useEffect(() => {
        if (showPanel) {
            openModal(MODAL_ID);
        } else {
            closeModal(MODAL_ID);
        }
    }, [showPanel]);

    return (
        <Modal
            id={MODAL_ID}
            title="Keyboard Shortcuts"
            className="canvas-shortcuts-modal"
            width="720px"
        >
            <Stack gap='1' p='1-5'>
                {groupedShortcuts.map(({ category, shortcuts }) => (
                    <Stack key={category} gap='05'>
                        <Heading level={3} size='xs' className="canvas-shortcuts-category text-uppercase">{category.charAt(0).toUpperCase() + category.slice(1)}</Heading>
                        <Stack gap='025'>
                            {shortcuts.map((shortcut: Shortcut) => (
                                <Row key={shortcut.id} justify='between' selectNone className="canvas-shortcut-row">
                                    <Text size='sm' tone='primary'>{shortcut.description}</Text>
                                    <Row gap='025' className="canvas-shortcut-keys">
                                        {shortcut.keys.map((key, i) => (
                                            <Row key={key} gap='025' as='span'>
                                                {i > 0 && <Text size='sm' tone='secondary'>+</Text>}
                                                <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                                            </Row>
                                        ))}
                                    </Row>
                                </Row>
                            ))}
                        </Stack>
                    </Stack>
                ))}
            </Stack>
        </Modal>
    );
};

export default KeyboardShortcutsPanel;
