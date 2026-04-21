import Popover from '@/shared/presentation/components/Popover';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import { ChevronDown, Search } from 'lucide-react';
import * as tbIcons from 'react-icons/tb';
import { useId, useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import './IconPicker.css';

const ICON_ENTRIES: Array<[string, IconType]> = Object.entries(tbIcons)
    .filter(([name, component]) => /^Tb[A-Z]/.test(name) && typeof component === 'function') as Array<[string, IconType]>;

const DEFAULT_PAGE_SIZE = 160;
const FILTERED_PAGE_SIZE = 320;

interface IconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
    placeholder?: string;
    id?: string;
};

const humanizeName = (name: string): string => name.replace(/^Tb/, '').replace(/([A-Z])/g, ' $1').trim();

const IconPicker = ({ value, onChange, placeholder = 'Choose icon', id }: IconPickerProps) => {
    const autoId = useId();
    const popoverId = id ?? `icon-picker-${autoId}`;
    const [query, setQuery] = useState('');

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ICON_ENTRIES.slice(0, DEFAULT_PAGE_SIZE);
        return ICON_ENTRIES
            .filter(([name]) => name.toLowerCase().includes(q))
            .slice(0, FILTERED_PAGE_SIZE);
    }, [query]);

    const trigger = (
        <button
            type='button'
            className='icon-picker-trigger'
            aria-label={value ? `Change icon (current: ${humanizeName(value)})` : placeholder}
        >
            {value ? (
                <>
                    <span className='icon-picker-trigger-icon' aria-hidden='true'>
                        <DynamicIcon iconName={value} size={16} />
                    </span>
                    <span className='icon-picker-trigger-label'>{humanizeName(value)}</span>
                </>
            ) : (
                <span className='icon-picker-trigger-placeholder'>{placeholder}</span>
            )}
            <ChevronDown size={12} aria-hidden='true' className='icon-picker-trigger-caret' />
        </button>
    );

    return (
        <Popover
            id={popoverId}
            trigger={trigger}
            noPadding
            placement='bottom-end'
            role='dialog'
            ariaLabel='Icon picker'
        >
            {(close) => (
                <div className='icon-picker-panel'>
                    <div className='icon-picker-search'>
                        <Search size={14} aria-hidden='true' />
                        <input
                            type='text'
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder='Search Tabler icons…'
                            aria-label='Search icons'
                        />
                    </div>

                    <div className='icon-picker-grid' role='listbox' aria-label='Available icons'>
                        {matches.length === 0 ? (
                            <div className='icon-picker-empty'>No icons match “{query.trim()}”.</div>
                        ) : matches.map(([name, IconComponent]) => {
                            const isSelected = name === value;
                            return (
                                <button
                                    key={name}
                                    type='button'
                                    role='option'
                                    aria-selected={isSelected}
                                    title={humanizeName(name)}
                                    className={`icon-picker-cell ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        onChange(name);
                                        close();
                                    }}
                                >
                                    <IconComponent size={18} />
                                </button>
                            );
                        })}
                    </div>

                    {matches.length > 0 && query && matches.length === FILTERED_PAGE_SIZE && (
                        <div className='icon-picker-footer'>
                            Showing first {FILTERED_PAGE_SIZE} matches. Refine your search for more.
                        </div>
                    )}
                </div>
            )}
        </Popover>
    );
};

export default IconPicker;
