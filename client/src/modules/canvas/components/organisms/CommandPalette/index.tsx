import { useCommandPaletteStore } from '../../../stores/use-command-palette-store';
import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import { triggerShortcutAction } from '../../../utilities/shortcut-actions';
import formatKeyName from '../../../utilities/format-key-name';

import { useEffect, useMemo, useRef, useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import SearchInput from '@/shared/presentation/components/SearchInput';

import type { Shortcut } from '../../../stores/use-keyboard-shortcuts-store';

import './CommandPalette.css';

const MODAL_ID = 'canvas-command-palette';

interface CommandItem {
    id: string;
    label: string;
    category: string;
    keys: string[];
};

const buildCommandItems = (shortcuts: Map<string, Shortcut>): CommandItem[] => {
    const items: CommandItem[] = [];
    shortcuts.forEach((shortcut) => {
        if (shortcut.id === 'command-palette' || shortcut.id === 'escape') return;
        if (shortcut.enabled === false) return;
        items.push({
            id: shortcut.id,
            label: shortcut.description,
            category: shortcut.category ?? 'general',
            keys: shortcut.keys
        });
    });
    return items;
};

const fuzzyMatch = (query: string, value: string): boolean => {
    if (!query) return true;
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedValue = value.toLowerCase();
    if (normalizedValue.includes(normalizedQuery)) return true;

    let queryIndex = 0;
    for (let i = 0; i < normalizedValue.length && queryIndex < normalizedQuery.length; i += 1) {
        if (normalizedValue[i] === normalizedQuery[queryIndex]) queryIndex += 1;
    }
    return queryIndex === normalizedQuery.length;
};

const CommandPalette = () => {
    const isOpen = useCommandPaletteStore((state) => state.isOpen);
    const close = useCommandPaletteStore((state) => state.close);
    const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);

    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const commandItems = useMemo(() => buildCommandItems(shortcuts), [shortcuts]);

    const filteredItems = useMemo(() => {
        if (!query.trim()) return commandItems;
        return commandItems.filter((item) => fuzzyMatch(query, `${item.label} ${item.category}`));
    }, [commandItems, query]);

    useEffect(() => {
        if (isOpen) {
            openModal(MODAL_ID);
            setQuery('');
            setActiveIndex(0);
        } else {
            closeModal(MODAL_ID);
        }
    }, [isOpen]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    useEffect(() => {
        if (!isOpen) return;
        const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(timeoutId);
    }, [isOpen]);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const active = list.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`);
        active?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, filteredItems.length]);

    const runCommand = (item: CommandItem) => {
        close();
        window.setTimeout(() => triggerShortcutAction(item.id), 50);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => Math.min(filteredItems.length - 1, index + 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(0, index - 1));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const item = filteredItems[activeIndex];
            if (item) runCommand(item);
        }
    };

    return (
        <Modal
            id={MODAL_ID}
            className='canvas-command-palette'
            width='560px'
            onClose={() => useCommandPaletteStore.getState().close()}
        >
            <Container className='d-flex column gap-05 p-075' onKeyDown={handleKeyDown}>
                <SearchInput
                    ref={inputRef}
                    id='canvas-command-palette-input'
                    aria-label='Search commands'
                    placeholder='Search commands…'
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    data-modal-initial-focus='true'
                />

                <ul
                    ref={listRef}
                    role='listbox'
                    aria-label='Available commands'
                    aria-activedescendant={filteredItems[activeIndex] ? `canvas-command-${filteredItems[activeIndex].id}` : undefined}
                    className='canvas-command-palette__list d-flex column gap-025'
                >
                    {filteredItems.length === 0 && (
                        <li className='canvas-command-palette__empty font-size-2 color-secondary'>No commands match "{query}"</li>
                    )}
                    {filteredItems.map((item, index) => (
                        <li
                            key={item.id}
                            id={`canvas-command-${item.id}`}
                            data-command-index={index}
                            role='option'
                            aria-selected={index === activeIndex}
                            className={`canvas-command-palette__item d-flex items-center content-between gap-05${index === activeIndex ? ' is-active' : ''}`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => runCommand(item)}
                        >
                            <Container className='d-flex column gap-025'>
                                <span className='font-size-2 color-primary'>{item.label}</span>
                                <span className='font-size-05 color-muted'>{item.category}</span>
                            </Container>
                            <Container className='d-flex items-center gap-025'>
                                {item.keys.map((key, keyIndex) => (
                                    <span key={key} className='d-flex items-center gap-025'>
                                        {keyIndex > 0 && <span className='font-size-05 color-secondary'>+</span>}
                                        <kbd className='canvas-command-palette__key font-size-05'>{formatKeyName(key)}</kbd>
                                    </span>
                                ))}
                            </Container>
                        </li>
                    ))}
                </ul>
            </Container>
        </Modal>
    );
};

export default CommandPalette;
