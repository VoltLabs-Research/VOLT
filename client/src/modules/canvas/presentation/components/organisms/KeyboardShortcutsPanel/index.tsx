import { useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine } from 'react-icons/ri';
import { useKeyboardShortcutsStore, type Shortcut } from '@/modules/canvas/presentation/stores/use-keyboard-shortcuts-store';
import Title from '@/shared/presentation/components/Title';
import './KeyboardShortcutsPanel.css';

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
        'pagedown': 'PgDn'
    };
    return keyMap[key.toLowerCase()] || key.toUpperCase();
};

const KeyCombo = ({ keys }: { keys: string[] }) => (
    <div className='d-flex items-center gap-025 f-shrink-0'>
        {keys.map((key, i) => (
            <Fragment key={key}>
                {i > 0 && <span className='color-muted font-size-1'>+</span>}
                <kbd className='key font-size-1 font-weight-5'>{formatKeyName(key)}</kbd>
            </Fragment>
        ))}
    </div>
);

const formatCategoryTitle = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
};

const CATEGORY_ORDER = ['playback', 'view', 'navigation', 'tools', 'general'];

const KeyboardShortcutsPanel = () => {
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const setShowPanel = useKeyboardShortcutsStore((s) => s.setShowPanel);
    const getShortcutsByCategory = useKeyboardShortcutsStore((s) => s.getShortcutsByCategory);

    const groupedShortcuts = useMemo(() => {
        const groups = getShortcutsByCategory();
        return CATEGORY_ORDER
            .filter((cat) => groups[cat]?.length > 0)
            .map((cat) => ({ category: cat, shortcuts: groups[cat] }));
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
                    className='shortcuts-panel-overlay p-fixed inset-0 d-flex flex-center'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        className='d-flex column shortcuts-panel glass-bg b-none overflow-hidden radius-xl'
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <header className='panel-header-bordered d-flex items-center content-between f-shrink-0 p-1-5'>
                            <Title className='font-size-4 font-weight-5'>Keyboard Shortcuts</Title>
                            <button
                                className='d-flex items-center content-center cursor-pointer shortcuts-panel-close radius-sm color-secondary transition-fast b-none'
                                onClick={handleClose}
                                aria-label='Close shortcuts panel'
                            >
                                <RiCloseLine size={22} />
                            </button>
                        </header>

                        <div className='d-flex column gap-1-5 y-auto p-1-5 flex-1'>
                            {groupedShortcuts.map(({ category, shortcuts }) => (
                                <section key={category} className='d-flex column gap-05'>
                                    <h3 className='shortcuts-category-title color-muted font-weight-5 font-size-1'>
                                        {formatCategoryTitle(category)}
                                    </h3>
                                    <div className='d-flex column gap-01'>
                                        {shortcuts.map((shortcut: Shortcut) => (
                                            <div key={shortcut.id} className='d-flex content-between items-center list-item-hoverable'>
                                                <span className='color-secondary font-size-2'>
                                                    {shortcut.description}
                                                </span>
                                                <KeyCombo keys={shortcut.keys} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <footer className='panel-footer-bordered text-center f-shrink-0 p-1'>
                            <span className='color-muted font-size-1'>
                                Press <kbd className='key font-size-1 font-weight-5 p-05'>CTRL</kbd><span className='color-muted font-size-1'>+</span><kbd className='key font-size-1 font-weight-5 p-05'>K</kbd> to toggle this panel
                            </span>
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KeyboardShortcutsPanel;
