import { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/use-keyboard-shortcuts-store';
import '@/shared/presentation/components/ShortcutFeedback/ShortcutFeedback.css';

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
                    className='shortcut-feedback p-fixed gap-075'
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className='shortcut-feedback-keys gap-025'>
                        {shortcut.keys.map((key, i) => (
                            <Fragment key={key}>
                                {i > 0 && <span className='shortcut-feedback-separator'>+</span>}
                                <kbd className='shortcut-feedback-key font-size-1 font-weight-5'>{formatKeyName(key)}</kbd>
                            </Fragment>
                        ))}
                    </div>
                    <span className='shortcut-feedback-description font-weight-5'>
                        {lastTriggered.description}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ShortcutFeedback;
