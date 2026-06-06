import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import './Titlebar.css';
import { pageTitleForPath, searchPages } from './pages';

interface TitlebarProps{
    ready: boolean;
    currentPath: string | null;
    onNavigate: (path: string) => void;
    onBack: () => void;
    onForward: () => void;
}

interface Item{
    title: string;
    path: string;
    raw?: boolean;
}

const ChevronLeft = () => (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M15 18l-6-6 6-6' /></svg>
);

const ChevronRight = () => (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M9 18l6-6-6-6' /></svg>
);

const SearchIcon = () => (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='11' cy='11' r='7' /><path d='M21 21l-4.35-4.35' /></svg>
);

const Titlebar = ({ ready, currentPath, onNavigate, onBack, onForward }: TitlebarProps) => {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const items = useMemo<Item[]>(() => {
        const matches: Item[] = searchPages(query).slice(0, 8).map((p) => ({ title: p.title, path: p.path }));
        const trimmed = query.trim();
        if(trimmed.startsWith('/') && !matches.some((m) => m.path === trimmed)){
            matches.push({ title: `Ir a ${trimmed}`, path: trimmed, raw: true });
        }
        return matches;
    }, [query]);

    const currentLabel = currentPath ? (pageTitleForPath(currentPath) ?? currentPath) : '';
    const value = focused ? query : currentLabel;
    const open = focused && items.length > 0;

    const go = (item?: Item) => {
        const target = item ?? items[active];
        if(!target) return;
        onNavigate(target.path);
        setQuery('');
        setFocused(false);
        inputRef.current?.blur();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if(event.key === 'ArrowDown'){ event.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
        else if(event.key === 'ArrowUp'){ event.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if(event.key === 'Enter'){ event.preventDefault(); go(); }
        else if(event.key === 'Escape'){ inputRef.current?.blur(); }
    };

    return (
        <header className='titlebar'>
            <div className='traffic'>
                <button className='light close' onClick={() => window.volt.window.close()} aria-label='Close' />
                <button className='light min' onClick={() => window.volt.window.minimize()} aria-label='Minimize' />
                <button className='light max' onClick={() => window.volt.window.maximize()} aria-label='Maximize' />
            </div>

            <div className='nav-buttons'>
                <button className='nav-btn' onClick={onBack} disabled={!ready} aria-label='Back'><ChevronLeft /></button>
                <button className='nav-btn' onClick={onForward} disabled={!ready} aria-label='Forward'><ChevronRight /></button>
            </div>

            <div className='search-wrap'>
                <div className={`search ${open ? 'open' : ''}`}>
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        className='search-input'
                        value={value}
                        disabled={!ready}
                        spellCheck={false}
                        placeholder={ready ? 'Buscar o ir a una página…' : 'Starting Volt…'}
                        onFocus={() => { setFocused(true); setQuery(''); setActive(0); }}
                        onBlur={() => setFocused(false)}
                        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                        onKeyDown={onKeyDown}
                    />
                </div>

                {open && (
                    <ul className='results'>
                        {items.map((item, index) => (
                            <li
                                key={`${item.path}-${index}`}
                                className={`result ${index === active ? 'active' : ''}`}
                                onMouseEnter={() => setActive(index)}
                                onMouseDown={(event) => { event.preventDefault(); go(item); }}
                            >
                                <span className='result-title'>{item.title}</span>
                                {!item.raw && <span className='result-path'>{item.path}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </header>
    );
};

export default Titlebar;
