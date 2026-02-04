import { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardShortcutsStore } from '@/modules/canvas/presentation/stores/use-keyboard-shortcuts-store';
import './ShortcutFeedback.css';

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
        'escape': 'Esc'
    };
    return keyMap[key.toLowerCase()] || key.toUpperCase();
};

const ShortcutFeedback = () => {
    const lastTriggered = useKeyboardShortcutsStore((s) => s.lastTriggered);
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);

    const shortcut = lastTriggered ? shortcuts.get(lastTriggered.id) : null;

    return (
        <AnimatePresence>
            {lastTriggered && shortcut && (
                <motion.div
                    className='shortcut-feedback glass-bg b-none p-fixed gap-075 d-flex items-center radius-lg p-075'
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className='shortcut-feedback-keys gap-025 d-flex items-center f-shrink-0'>
                        {shortcut.keys.map((key, i) => (
                            <Fragment key={key}>
                                {i > 0 && <span className='color-muted font-size-1'>+</span>}
                                <kbd className='key font-size-1 font-weight-5 p-05'>{formatKeyName(key)}</kbd>
                            </Fragment>
                        ))}
                    </div>
                    <span className='font-weight-5 font-size-2 color-secondary text-truncate'>
                        {lastTriggered.description}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ShortcutFeedback;
