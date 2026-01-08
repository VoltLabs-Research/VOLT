import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { List } from 'react-window';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import { ICON_LIB_LOADERS } from '@/components/atoms/common/DynamicIcon/loaders';
import '@/components/molecules/form/IconSelect/IconSelect.css';

type IconLib = keyof typeof ICON_LIB_LOADERS;

interface IconSelectProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    renderInPortal?: boolean;
}

let allIconsCache: string[] | null = null;
let loadingPromise: Promise<string[]> | null = null;

const loadAllIcons = async(): Promise<string[]> =>{
    if(allIconsCache) return allIconsCache;
    if(loadingPromise) return loadingPromise;

    loadingPromise = (async() => {
        const libs = Object.keys(ICON_LIB_LOADERS) as IconLib[];
        const results: string[] = [];

        const modules = await Promise.all(
            libs.map(lib => ICON_LIB_LOADERS[lib]().catch(() => null))
        );

        for(const mod of modules){
            if(!mod) continue;
            const names = Object.keys(mod).filter(key =>
                typeof (mod as Record<string, unknown>)[key] === 'function' &&
                /^[A-Z]/.test(key)
            );
            results.push(...names);
        }

        allIconsCache = results;
        return results;
    })();

    return loadingPromise;
};

// Pure function for worker - filters icons by search term
const filterIconsWorker = (icons: string[], searchTerm: string): string[] => {
    if(!searchTerm) return icons;
    const lower = searchTerm.toLowerCase();
    return icons.filter(name => name.toLowerCase().includes(lower));
};

const ITEM_HEIGHT = 36;
const LIST_HEIGHT = 280;

const VirtualizedRow = (props: any) => {
    const { index, style, icons, value, highlightedIndex, onSelect, onHighlight } = props;
    const iconName = icons[index];
    const isSelected = iconName === value;
    const isActive = index === highlightedIndex;

    return (
        <div
            style={style}
            className={`d-flex items-center gap-05 icon-select-option ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''} color-primary u-select-none cursor-pointer`}
            onClick={() => onSelect(iconName)}
            onMouseEnter={() => onHighlight(index)}
        >
            <div className="d-flex flex-center icon-select-option-icon f-shrink-0">
                <DynamicIcon iconName={iconName} size={18} />
            </div>
            <span className="flex-1 icon-select-option-name overflow-hidden">{iconName}</span>
        </div>
    );
};

const IconSelect: React.FC<IconSelectProps> = ({
    value,
    onChange,
    placeholder = 'Select icon...',
    renderInPortal = false
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [allIcons, setAllIcons] = useState<string[]>(allIconsCache || []);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    const filteredIcons = useMemo(() => {
        if(allIcons.length === 0) return [];
        if(!search) return allIcons;
        return filterIconsWorker(allIcons, search);
    }, [allIcons, search]);

    // Load all icons when dropdown opens
    useEffect(() => {
        if(!open) return;

        if(allIconsCache){
            setAllIcons(allIconsCache);
            return;
        }

        setLoading(true);
        loadAllIcons().then(icons => {
            setAllIcons(icons);
            setLoading(false);
        });
    }, [open]);

    // Close dropdown when clicking outside
    useEffect(() => {
        if(!open) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideRoot = rootRef.current?.contains(target);
            const insideDropdown = dropdownRef.current?.contains(target);
            if(!(insideRoot || insideDropdown)) setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Update portal position
    useEffect(() => {
        if(!open || !renderInPortal) return;

        const updatePosition = () => {
            const trigger = triggerRef.current;
            if(!trigger) return;
            const rect = trigger.getBoundingClientRect();
            setPortalStyle({
                position: 'fixed',
                top: rect.bottom + 6,
                left: rect.left,
                width: Math.max(280, rect.width),
                zIndex: 2147483647
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, renderInPortal]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if(open){
            setTimeout(() => searchInputRef.current?.focus(), 0);
        }
    }, [open]);

    // Reset highlighted index and scroll to top when filter changes
    useEffect(() => {
        setHighlightedIndex(0);
        if(listContainerRef.current){
            const scrollContainer = listContainerRef.current.querySelector('[style*="overflow"]');
            if(scrollContainer) scrollContainer.scrollTop = 0;
        }
    }, [filteredIcons]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const maxIndex = filteredIcons.length - 1;

        switch(e.key){
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(maxIndex, i + 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(0, i - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if(filteredIcons[highlightedIndex]){
                    onChange(filteredIcons[highlightedIndex]);
                    setOpen(false);
                }
                break;
            case 'Escape':
                setOpen(false);
                break;
        }
    }, [filteredIcons, highlightedIndex, onChange]);

    const handleSelect = useCallback((name: string) => {
        onChange(name);
        setOpen(false);
    }, [onChange]);

    const dropdownContent = (
        <div
            ref={dropdownRef}
            className="d-flex column icon-select-dropdown p-absolute w-max overflow-hidden"
            style={renderInPortal && portalStyle ? portalStyle : undefined}
        >
            <div className="icon-select-search">
                <input
                    ref={searchInputRef}
                    type="text"
                    className="icon-select-search-input w-max color-primary"
                    placeholder="Search icons..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            <div className="flex-1 icon-select-list y-auto" ref={listContainerRef}>
                {loading ? (
                    <div className="d-flex flex-center gap-05 icon-select-loading color-muted p-1">Loading all icons...</div>
                ) : filteredIcons.length === 0 ? (
                    <div className="d-flex flex-center icon-select-empty color-muted p-1-5">No icons found</div>
                ) : (
                    <div style={{ height: LIST_HEIGHT, overflow: 'auto' }}>
                        <List
                            rowCount={filteredIcons.length}
                            rowHeight={ITEM_HEIGHT}
                            rowComponent={VirtualizedRow}
                            rowProps={{
                                icons: filteredIcons,
                                value,
                                highlightedIndex,
                                onSelect: handleSelect,
                                onHighlight: setHighlightedIndex
                            }}
                        />
                    </div>
                )}
            </div>

            {!loading && filteredIcons.length > 0 && (
                <div className="icon-select-count color-muted">
                    {filteredIcons.length.toLocaleString()} icons
                </div>
            )}
        </div>
    );

    return (
        <div
            ref={rootRef}
            className={`icon-select ${open ? 'is-open' : ''} p-relative w-max`}
        >
            <button
                ref={triggerRef}
                type="button"
                className="d-flex items-center gap-05 icon-select-trigger w-max color-primary cursor-pointer"
                onClick={() => setOpen(!open)}
            >
                {value && (
                    <div className="d-flex flex-center icon-select-trigger-preview f-shrink-0">
                        <DynamicIcon iconName={value} size={18} />
                    </div>
                )}
                <span className={`flex-1 icon-select-trigger-value ${!value ? 'is-placeholder' : ''} overflow-hidden`}>
                    {value || placeholder}
                </span>
                <svg
                    className="icon-select-chevron f-shrink-0"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
            </button>

            {open && (renderInPortal ? createPortal(dropdownContent, document.body) : dropdownContent)}
        </div>
    );
};

export default IconSelect;
