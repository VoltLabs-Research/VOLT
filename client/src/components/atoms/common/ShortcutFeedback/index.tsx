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

import React, { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardShortcutsStore } from '@/stores/slices/ui/keyboard-shortcuts-slice';
import './ShortcutFeedback.css';

/**
 * Format key name for display
 */
const formatKeyName = (key: string): string => {
    const keyMap: Record<string, string> = {
        'ctrl': 'CTRL',
        'shift': '⇧',
        'alt': '⌥',
        'meta': '⌘',
        'arrowleft': '←',
        'arrowright': '→',
        'arrowup': '↑',
        'arrowdown': '↓',
        'space': '␣',
        'escape': 'Esc',
    };
    return keyMap[key.toLowerCase()] || key.toUpperCase();
};

/**
 * Visual feedback toast when a keyboard shortcut is triggered.
 * Shows briefly in the bottom center of the screen.
 */
const ShortcutFeedback: React.FC = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);

    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    return (
        <AnimatePresence>
            {lastTriggered && shortcut && (
                <motion.div
                    className="shortcut-feedback p-fixed gap-075"
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="shortcut-feedback-keys gap-025">
                        {shortcut.keys.map((key, i) => (
                            <Fragment key={key}>
                                {i > 0 && <span className="shortcut-feedback-separator">+</span>}
                                <kbd className="shortcut-feedback-key font-size-1 font-weight-5">{formatKeyName(key)}</kbd>
                            </Fragment>
                        ))}
                    </div>
                    <span className="shortcut-feedback-description font-weight-5">
                        {lastTriggered.description}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ShortcutFeedback;
