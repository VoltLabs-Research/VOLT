import { useMemo, useEffect } from 'react';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { useKeyboardShortcutsStore, type Shortcut } from '../../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../../utils/format-key-name';
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
            <Container className="d-flex column gap-1 p-1-5">
                {groupedShortcuts.map(({ category, shortcuts }) => (
                    <Container key={category} className="d-flex column gap-05">
                        <Title className="canvas-shortcuts-category font-size-05">{category.charAt(0).toUpperCase() + category.slice(1)}</Title>
                        <Container className="d-flex column gap-025">
                            {shortcuts.map((shortcut: Shortcut) => (
                                <Container key={shortcut.id} className="canvas-shortcut-row d-flex items-center content-between u-select-none">
                                    <span className="font-size-1 color-primary">{shortcut.description}</span>
                                    <Container className="canvas-shortcut-keys d-flex items-center gap-025">
                                        {shortcut.keys.map((key, i) => (
                                            <span key={key} className="d-flex items-center gap-025">
                                                {i > 0 && <span className="font-size-1 color-secondary">+</span>}
                                                <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                                            </span>
                                        ))}
                                    </Container>
                                </Container>
                            ))}
                        </Container>
                    </Container>
                ))}
            </Container>
        </Modal>
    );
};

export default KeyboardShortcutsPanel;
