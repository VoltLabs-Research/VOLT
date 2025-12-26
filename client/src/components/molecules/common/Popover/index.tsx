import React, { type ReactNode } from 'react';
import './Popover.css';

declare global {
    namespace React {
        interface HTMLAttributes<T> {
            popover?: '' | 'auto' | 'manual' | 'hint';
            popovertarget?: string;
            popovertargetaction?: 'toggle' | 'show' | 'hide';
            commandfor?: string;
            command?: string;
        }
    }
}

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode;
    type?: 'auto' | 'manual';
    className?: string;
    noPadding?: boolean;
    triggerAction?: 'click' | 'contextmenu';
}

const hideAllOtherPopovers = (keepId: string) => {
    const open = document.querySelectorAll<HTMLElement>('[popover]:popover-open');
    open.forEach((el) => {
        if (el.id !== keepId) {
            try {
                (el as any).hidePopover();
            } catch {}
        }
    });
};

const Popover = ({
    id,
    trigger,
    children,
    type = 'auto',
    className = '',
    noPadding = false,
    triggerAction = 'click'
}: PopoverProps) => {
    const clickPosRef = React.useRef<{ x: number; y: number } | null>(null);
    const triggerRectRef = React.useRef<DOMRect | null>(null);
    const ignoreNextOutsideRef = React.useRef(false);

    const getPopover = React.useCallback(() => document.getElementById(id), [id]);

    const positionPopover = React.useCallback(() => {
        const popover = getPopover();
        if (!popover) return;

        requestAnimationFrame(() => {
            const rect = popover.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const padding = 16;
            const gap = 8;

            let left = padding;
            let top = padding;

            if (triggerAction === 'click' && triggerRectRef.current) {
                const tr = triggerRectRef.current;

                left = tr.left;
                top = tr.bottom + gap;

                if (left + rect.width > vw - padding) {
                    left = tr.right - rect.width;
                }

                if (top + rect.height > vh - padding) {
                    top = tr.top - rect.height - gap;
                }
            } else if (clickPosRef.current) {
                const { x, y } = clickPosRef.current;

                left = x;
                top = y;

                if (left + rect.width > vw - padding) {
                    left = x - rect.width;
                }

                if (top + rect.height > vh - padding) {
                    top = y - rect.height;
                }
            }

            if (left < padding) left = padding;
            if (top < padding) top = padding;

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
            popover.style.margin = '0';
            popover.style.maxWidth = `calc(100vw - ${padding * 2}px)`;
        });
    }, [getPopover, triggerAction]);

    const toggleOpen = React.useCallback((source: 'click' | 'contextmenu', e: MouseEvent, triggerEl: HTMLElement) => {
        const popover = getPopover();
        if (!popover) return;

        hideAllOtherPopovers(id);

        const isOpen = popover.matches(':popover-open');
        if (isOpen) {
            try {
                (popover as any).hidePopover();
            } catch {}
            return;
        }

        ignoreNextOutsideRef.current = true;

        if (source === 'click') {
            triggerRectRef.current = triggerEl.getBoundingClientRect();
            clickPosRef.current = null;
        } else {
            clickPosRef.current = { x: e.clientX, y: e.clientY };
            triggerRectRef.current = null;
        }

        try {
            (popover as any).showPopover();
        } catch {}

        setTimeout(positionPopover, 0);
    }, [getPopover, id, positionPopover]);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const triggerEl = target.closest(`[data-popover-trigger="${id}"]`) as HTMLElement | null;
            if (!triggerEl) return;

            if (triggerAction === 'click' && e.type === 'click') {
                toggleOpen('click', e, triggerEl);
                return;
            }

            if (triggerAction === 'contextmenu' && e.type === 'contextmenu') {
                e.preventDefault();
                e.stopPropagation();
                toggleOpen('contextmenu', e, triggerEl);
            }
        };

        if (triggerAction === 'click') {
            document.addEventListener('click', handler, true);
        } else {
            document.addEventListener('contextmenu', handler, true);
        }

        return () => {
            if (triggerAction === 'click') {
                document.removeEventListener('click', handler, true);
            } else {
                document.removeEventListener('contextmenu', handler, true);
            }
        };
    }, [id, triggerAction, toggleOpen]);

    React.useEffect(() => {
        const popover = getPopover();
        if (!popover) return;

        const onToggle = (e: any) => {
            if (e.newState === 'open') setTimeout(positionPopover, 0);
        };

        popover.addEventListener('toggle', onToggle);
        return () => popover.removeEventListener('toggle', onToggle);
    }, [getPopover, positionPopover]);

    React.useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            const popover = getPopover();
            if (!popover) return;
            if (!popover.matches(':popover-open')) return;

            if (ignoreNextOutsideRef.current) {
                ignoreNextOutsideRef.current = false;
                return;
            }

            const t = e.target as HTMLElement;
            const insidePopover = t.closest(`#${CSS.escape(id)}`);
            const insideAnyTrigger = t.closest('[data-popover-trigger]');

            if (!insidePopover && !insideAnyTrigger) {
                try {
                    (popover as any).hidePopover();
                } catch {}
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const popover = getPopover();
            if (!popover) return;
            try {
                (popover as any).hidePopover();
            } catch {}
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [id, getPopover]);

    const effectiveType: 'auto' | 'manual' = triggerAction === 'contextmenu' ? 'manual' : type;

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as React.ReactElement<any>, {
                    'data-popover-trigger': id
                })
            ) : null}

            <div
                id={id}
                popover={effectiveType}
                className={`volt-popover d-flex column glass-bg p-fixed ${noPadding ? '' : 'p-05'} ${className} color-primary`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </>
    );
};

export default Popover;
