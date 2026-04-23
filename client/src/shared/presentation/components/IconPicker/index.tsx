import { Popover } from '@/shared/presentation/primitives';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import { Loader } from '@/shared/presentation/primitives';
import { ICON_LIB_LOADERS } from '@/shared/presentation/components/DynamicIcon/loaders';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import './IconPicker.css';

type IconEntry = [string, IconType];

const DEFAULT_PAGE_SIZE = 160;
const FILTERED_PAGE_SIZE = 320;

const ICON_ENTRIES_CACHE = new Map<keyof typeof ICON_LIB_LOADERS, IconEntry[]>();
const ICON_ENTRIES_PROMISES = new Map<keyof typeof ICON_LIB_LOADERS, Promise<IconEntry[]>>();

const TB_PREFIX_RE = /^Tb[A-Z]/;

const loadTablerEntries = (): Promise<IconEntry[]> => {
    const cached = ICON_ENTRIES_CACHE.get('tb');
    if (cached) return Promise.resolve(cached);

    const inflight = ICON_ENTRIES_PROMISES.get('tb');
    if (inflight) return inflight;

    const promise = ICON_LIB_LOADERS.tb()
        .then((module) => {
            const entries = Object.entries(module)
                .filter(([name, component]) => TB_PREFIX_RE.test(name) && typeof component === 'function') as IconEntry[];
            ICON_ENTRIES_CACHE.set('tb', entries);
            ICON_ENTRIES_PROMISES.delete('tb');
            return entries;
        })
        .catch((error) => {
            ICON_ENTRIES_PROMISES.delete('tb');
            throw error;
        });

    ICON_ENTRIES_PROMISES.set('tb', promise);
    return promise;
};

interface IconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
    placeholder?: string;
    id?: string;
};

const humanizeName = (name: string): string => name.replace(/^Tb/, '').replace(/([A-Z])/g, ' $1').trim();

interface IconPickerPanelProps {
    value: string;
    onChange: (iconName: string) => void;
    close: () => void;
};

const IconPickerPanel = ({ value, onChange, close }: IconPickerPanelProps) => {
    const [query, setQuery] = useState('');
    const [entries, setEntries] = useState<IconEntry[] | null>(() => ICON_ENTRIES_CACHE.get('tb') ?? null);
    const [loadError, setLoadError] = useState<Error | null>(null);
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        if (ICON_ENTRIES_CACHE.has('tb')) {
            setEntries(ICON_ENTRIES_CACHE.get('tb') ?? null);
            return;
        }

        let cancelled = false;
        setLoadError(null);

        loadTablerEntries()
            .then((loaded) => {
                if (cancelled) return;
                setEntries(loaded);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setLoadError(error instanceof Error ? error : new Error('Failed to load icons'));
            });

        return () => {
            cancelled = true;
        };
    }, [retryToken]);

    const matches = useMemo(() => {
        if (!entries) return [] as IconEntry[];
        const q = query.trim().toLowerCase();
        if (!q) return entries.slice(0, DEFAULT_PAGE_SIZE);
        return entries
            .filter(([name]) => name.toLowerCase().includes(q))
            .slice(0, FILTERED_PAGE_SIZE);
    }, [query, entries]);

    const isLoading = !entries && !loadError;

    return (
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
                    disabled={isLoading || Boolean(loadError)}
                />
            </div>

            <div className='icon-picker-grid' role='listbox' aria-label='Available icons'>
                {isLoading ? (
                    <div className='icon-picker-empty' role='status' aria-live='polite'>
                        <Loader scale={0.4} isFixed={false} label='Loading icons…' />
                    </div>
                ) : loadError ? (
                    <div className='icon-picker-empty'>
                        Couldn’t load icons.{' '}
                        <button
                            type='button'
                            className='icon-picker-retry'
                            onClick={() => setRetryToken((token) => token + 1)}
                        >
                            Retry
                        </button>
                    </div>
                ) : matches.length === 0 ? (
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

            {!isLoading && !loadError && matches.length > 0 && query && matches.length === FILTERED_PAGE_SIZE && (
                <div className='icon-picker-footer'>
                    Showing first {FILTERED_PAGE_SIZE} matches. Refine your search for more.
                </div>
            )}
        </div>
    );
};

const IconPicker = ({ value, onChange, placeholder = 'Choose icon', id }: IconPickerProps) => {
    const autoId = useId();
    const popoverId = id ?? `icon-picker-${autoId}`;

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
                <IconPickerPanel value={value} onChange={onChange} close={close} />
            )}
        </Popover>
    );
};

export default IconPicker;
