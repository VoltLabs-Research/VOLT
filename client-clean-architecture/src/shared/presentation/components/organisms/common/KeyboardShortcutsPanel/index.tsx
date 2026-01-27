/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine } from 'react-icons/ri';
import { useKeyboardShortcutsStore, type Shortcut } from '@/shared/presentation/stores/slices/ui/keyboard-shortcuts-slice';
import Title from '@/shared/presentation/components/primitives/Title';
import '@/shared/presentation/components/organisms/common/KeyboardShortcutsPanel/KeyboardShortcutsPanel.css';

/**
 * Format key name for display (e.g., 'arrowleft' -> '←')
 */
const formatKeyName = (key: string): string => {
    const keyMap: Record<string, string> = {
        'ctrl': 'CTRL',
        'control': 'CTRL',
        'shift': '⇧',
        'alt': '⌥',
        'meta': '⌘',
        'arrowleft': '←',
        'arrowright': '→',
        'arrowup': '↑',
        'arrowdown': '↓',
        'space': '␣',
        'escape': 'Esc',
        'enter': '↵',
        'backspace': '⌫',
        'delete': '⌦',
        'tab': '⇥',
        'home': 'Home',
        'end': 'End',
        'pageup': 'PgUp',
        'pagedown': 'PgDn',
    };
    return keyMap[key.toLowerCase()] || key.toUpperCase();
};

/**
 * Visual key combination display
 */
const KeyCombo: React.FC<{ keys: string[] }> = ({ keys }) => (
    <div className="d-flex items-center key-combo gap-025">
        {keys.map((key, i) => (
            <Fragment key={key}>
                {i > 0 && <span className="key-separator">+</span>}
                <kbd className="key font-size-1 font-weight-5">{formatKeyName(key)}</kbd>
            </Fragment>
        ))}
    </div>
);

/**
 * Category title formatting
 */
const formatCategoryTitle = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
};

/**
 * Category order for display
 */
const CATEGORY_ORDER = ['playback', 'view', 'navigation', 'tools', 'general'];

const KeyboardShortcutsPanel: React.FC = () => {
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const setShowPanel = useKeyboardShortcutsStore((s) => s.setShowPanel);
    const getShortcutsByCategory = useKeyboardShortcutsStore((s) => s.getShortcutsByCategory);

    const groupedShortcuts = useMemo(() => {
        const groups = getShortcutsByCategory();
        // Sort by predefined order
        return CATEGORY_ORDER
            .filter(cat => groups[cat]?.length > 0)
            .map(cat => ({ category: cat, shortcuts: groups[cat] }));
    }, [getShortcutsByCategory]);

    const handleClose = () => setShowPanel(false);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <AnimatePresence>
            {showPanel && (
                <motion.div
                    className="shortcuts-panel-overlay p-fixed inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        className="d-flex column shortcuts-panel overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <header className="shortcuts-panel-header d-flex items-center content-between">
                            <Title className="font-size-4 font-weight-5">Keyboard Shortcuts</Title>
                            <button
                                className="d-flex items-center cursor-pointer shortcuts-panel-close"
                                onClick={handleClose}
                                aria-label="Close shortcuts panel"
                            >
                                <RiCloseLine size={22} />
                            </button>
                        </header>

                        <div className="shortcuts-panel-content y-auto">
                            {groupedShortcuts.map(({ category, shortcuts }) => (
                                <section key={category} className="shortcuts-category">
                                    <h3 className="shortcuts-category-title font-weight-5">
                                        {formatCategoryTitle(category)}
                                    </h3>
                                    <div className="d-flex column shortcuts-list">
                                        {shortcuts.map((shortcut: Shortcut) => (
                                            <div key={shortcut.id} className="d-flex content-between items-center shortcut-item">
                                                <span className="shortcut-description font-size-2">
                                                    {shortcut.description}
                                                </span>
                                                <KeyCombo keys={shortcut.keys} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <footer className="shortcuts-panel-footer text-center">
                            <span className="shortcuts-hint color-tertiary font-size-1">
                                Press <kbd className="key font-size-1 font-weight-5">CTRL</kbd><span className="key-separator">+</span><kbd className="key font-size-1 font-weight-5">K</kbd> to toggle this panel
                            </span>
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KeyboardShortcutsPanel;
