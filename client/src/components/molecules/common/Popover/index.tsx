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
}

const Popover = ({
    id,
    trigger,
    children,
    type = 'auto',
    className = '',
    noPadding = false
}: PopoverProps) => {
    // Store click position for positioning
    const clickPosRef = React.useRef<{ x: number; y: number } | null>(null);

    // Capture click position when trigger is clicked
    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const triggerElement = target.closest(`[commandfor="${id}"]`);
            if (triggerElement) {
                clickPosRef.current = { x: e.clientX, y: e.clientY };
            }
        };
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [id]);

    // Position the popover near the click position when it opens
    React.useEffect(() => {
        const popover = document.getElementById(id);
        if (!popover) return;

        const positionPopover = () => {
            if (!clickPosRef.current) return;

            // Use requestAnimationFrame to ensure styles are applied
            requestAnimationFrame(() => {
                const popoverRect = popover.getBoundingClientRect();
                const { x, y } = clickPosRef.current!;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const padding = 16;

                // Calculate initial position (below and to the left of click for right-aligned triggers)
                let top = y + 8;
                let left = x - popoverRect.width; // Align right edge with click

                // If popover is wider than available space on left, position to right of click
                if (left < padding) {
                    left = x;
                }

                // Adjust if popover would go off-screen (right)
                if (left + popoverRect.width > viewportWidth - padding) {
                    left = viewportWidth - popoverRect.width - padding;
                }

                // Adjust if popover would go off-screen (bottom)
                if (top + popoverRect.height > viewportHeight - padding) {
                    // Show above the click instead
                    top = y - popoverRect.height - 8;
                }

                // Ensure left doesn't go negative
                if (left < padding) left = padding;

                // Ensure top doesn't go negative
                if (top < padding) top = padding;

                popover.style.top = `${top}px`;
                popover.style.left = `${left}px`;
                popover.style.margin = '0';
                popover.style.maxWidth = `calc(100vw - ${padding * 2}px)`;
            });
        };

        // Watch for toggle events to handle positioning
        const handleToggle = (e: any) => {
            if (e.newState === 'open') {
                // Use setTimeout to ensure popover is rendered, then position
                setTimeout(positionPopover, 0);
            }
        };

        // Position when popover opens
        popover.addEventListener('toggle', handleToggle);

        return () => {
            popover.removeEventListener('toggle', handleToggle);
        };
    }, [id]);

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as React.ReactElement<any>, {
                    commandfor: id,
                    command: "toggle-popover",
                    type: "button"
                })
            ) : null}

            <div
                id={id}
                popover={type}
                className={`volt-popover d-flex column glass-bg p-fixed ${noPadding ? '' : 'p-05'} ${className} color-primary`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </>
    );
};

export default Popover;
