import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import formatKeyName from '../../utilities/format-key-name';

import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { useMemo, useEffect } from 'react';
import Modal from '@/shared/presentation/components/Modal';
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
            <div className="volt-container d-flex column gap-1 p-1-5">
                {groupedShortcuts.map(({ category, shortcuts }) => (
                    <div key={category} className="volt-container d-flex column gap-05">
                        <h3 className="volt-title canvas-shortcuts-category font-size-05">{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                        <div className="volt-container d-flex column gap-025">
                            {shortcuts.map((shortcut: Shortcut) => (
                                <div key={shortcut.id} className="volt-container canvas-shortcut-row d-flex items-center content-between u-select-none">
                                    <span className="font-size-1 color-primary">{shortcut.description}</span>
                                    <div className="volt-container canvas-shortcut-keys d-flex items-center gap-025">
                                        {shortcut.keys.map((key, i) => (
                                            <span key={key} className="d-flex items-center gap-025">
                                                {i > 0 && <span className="font-size-1 color-secondary">+</span>}
                                                <kbd className="canvas-shortcut-key font-size-05">{formatKeyName(key)}</kbd>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default KeyboardShortcutsPanel;
