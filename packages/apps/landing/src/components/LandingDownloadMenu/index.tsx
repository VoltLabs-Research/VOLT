import { useLatestRelease } from '@/hooks/use-latest-release';
import { detectDesktopOs } from '@/utils/detect-desktop-os';
import { formatInstallerSize, listDesktopInstallers } from '@/utils/list-desktop-installers';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/* The hero's Download pill: it opens a menu with the latest release's installer for each OS. */
const LandingDownloadMenu = () => {
    const release = useLatestRelease();
    const installers = useMemo(() => listDesktopInstallers(release), [release]);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const close = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    // Opening lands on this device's installer, the one most visitors came for.
    useEffect(() => {
        if (!open) return;
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const os = detectDesktopOs();
        (items.find((item) => item.dataset.os === os) ?? items[0])?.focus();
    }, [open]);

    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close(true);
            return;
        }
        if (event.key === 'Tab') {
            setOpen(false);
            return;
        }
        if (!NAVIGATION_KEYS.has(event.key)) return;

        event.preventDefault();
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
    };

    return (
        <div ref={rootRef} className='landing-download'>
            <button
                ref={triggerRef}
                type='button'
                className='landing-pill landing-pill--lg landing-pill--ghost landing-download-trigger'
                aria-haspopup='menu'
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                Download
                <ChevronDown aria-hidden='true' size={16} />
            </button>
            {open && (
                <div ref={menuRef} id={menuId} role='menu' aria-label='Download VOLT Desktop' className='landing-download-menu' onKeyDown={handleMenuKeyDown}>
                    {installers.map((installer) => (
                        <a
                            key={installer.href + installer.name}
                            href={installer.href}
                            role='menuitem'
                            tabIndex={-1}
                            data-os={installer.os}
                            className='landing-download-item'
                            onClick={() => setOpen(false)}
                        >
                            <span>
                                {installer.name}
                                {installer.detail && <span className='landing-download-detail'>{installer.detail}</span>}
                            </span>
                            {installer.size !== null && <span className='landing-download-size'>{formatInstallerSize(installer.size)}</span>}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LandingDownloadMenu;
