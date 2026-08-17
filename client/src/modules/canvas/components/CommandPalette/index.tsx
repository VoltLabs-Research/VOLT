import { useCommandPaletteStore } from '../../store/use-command-palette-store';
import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { triggerShortcutAction } from '../../utils/shortcut-actions';
import formatKeyName from '../../utils/format-key-name';
import { Kbd } from '@heroui/react';

import Scrollable from '@/shared/ui/components/Scrollable';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchField } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';

import type { Shortcut } from '../../store/use-keyboard-shortcuts-store';

const MODAL_ID = 'canvas-command-palette';

interface CommandItem {
    id: string;
    label: string;
    category: string;
    keys: string[];
}

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
            className='max-w-[560px] w-[min(560px,calc(100vw-2rem))]'
            width='560px'
            onClose={() => useCommandPaletteStore.getState().close()}
        >
            <div className='flex flex-col gap-2 p-3' onKeyDown={handleKeyDown}>
                <SearchField
                    aria-label='Search commands'
                    value={query}
                    onChange={setQuery}
                    fullWidth
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input
                            ref={inputRef}
                            id='canvas-command-palette-input'
                            placeholder='Search commands…'
                            data-modal-initial-focus='true'
                        />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <Scrollable className='max-h-[420px] pt-2'>
                <ul className='m-0 flex list-none flex-col gap-1'
                    ref={listRef}
                    role='listbox'
                    aria-label='Available commands'
                    aria-activedescendant={filteredItems[activeIndex] ? `canvas-command-${filteredItems[activeIndex].id}` : undefined}
                >
                    {filteredItems.length === 0 && (
                        <li className='px-3 py-4 text-center text-sm text-muted'>No commands match "{query}"</li>
                    )}
                    {filteredItems.map((item, index) => (
                        <li
                            key={item.id}
                            id={`canvas-command-${item.id}`}
                            data-command-index={index}
                            role='option'
                            aria-selected={index === activeIndex}
                            className={index === activeIndex ? 'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors duration-[120ms] ease-out hover:bg-surface-hover bg-surface-hover' : 'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors duration-[120ms] ease-out hover:bg-surface-hover'}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => runCommand(item)}
                        >
                            <div className='flex flex-col gap-1'>
                                <span className='text-sm text-foreground'>{item.label}</span>
                                <span className='text-xs text-muted'>{item.category}</span>
                            </div>
                            {item.keys.length > 0 && (
                                <div className='flex flex-row items-center gap-1'>
                                    {item.keys.map((key, keyIndex) => (
                                        <span className='flex flex-row items-center gap-1' key={key}>
                                            {keyIndex > 0 && <span className='text-xs text-muted'>+</span>}
                                            <Kbd className='text-xs'>{formatKeyName(key)}</Kbd>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
                </Scrollable>
            </div>
        </Modal>
    );
};

export default CommandPalette;
