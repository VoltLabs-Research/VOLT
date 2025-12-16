import React, { type ReactNode } from 'react';
import './Popover.css';

declare global {
    namespace React {
        interface HTMLAttributes<T> {
            popover?: '' | 'auto' | 'manual' | 'hint';
            popovertarget?: string;
            popovertargetaction?: 'toggle' | 'show' | 'hide';
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
    const handleTriggerClick = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        // Native support works only on <button> or <input>
        const isNativeTrigger = (target.tagName === 'BUTTON' || target.tagName === 'INPUT') &&
            'popover' in HTMLElement.prototype;

        if (isNativeTrigger) return;

        // Fallback or explicit toggle for non-button elements
        const popover = document.getElementById(id) as any;
        if (popover) {
            if (typeof popover.togglePopover === 'function') {
                popover.togglePopover();
            } else if (typeof popover.showPopover === 'function') {
                popover.showPopover();
            }
        }
    };

    // Position the popover near the trigger when it opens
    React.useEffect(() => {
        const popover = document.getElementById(id);
        if (!popover) return;

        const positionPopover = () => {
            const triggerElement = document.querySelector(`[popovertarget="${id}"]`);
            if (!triggerElement || !popover) return;

            const triggerRect = triggerElement.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();

            // Position below the trigger by default
            let top = triggerRect.bottom + 8; // 8px gap
            let left = triggerRect.left;

            // Adjust if popover would go off-screen
            if (left + popoverRect.width > window.innerWidth) {
                left = window.innerWidth - popoverRect.width - 16;
            }

            if (top + popoverRect.height > window.innerHeight) {
                // Show above instead
                top = triggerRect.top - popoverRect.height - 8;
            }

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
            popover.style.margin = '0';
        };

        // Position when popover opens
        popover.addEventListener('toggle', (e: any) => {
            if (e.newState === 'open') {
                // Use setTimeout to ensure popover is rendered
                setTimeout(positionPopover, 0);
            }
        });

        return () => {
            popover.removeEventListener('toggle', positionPopover);
        };
    }, [id]);

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as React.ReactElement<any>, {
                    popovertarget: id,
                    type: "button",
                    onClick: (e: React.MouseEvent) => {
                        // Call original onClick if it exists
                        const originalOnClick = (trigger as any).props?.onClick;
                        if (originalOnClick) {
                            originalOnClick(e);
                        }
                        // Then call our fallback/explicit handler
                        handleTriggerClick(e);
                    }
                })
            ) : null}

            <div
                id={id}
                popover={type}
                className={`volt-popover d-flex gap-1 column        glass-bg p-fixed ${noPadding ? '' : 'p-05'} ${className}`}
            >
                {children}
            </div>
        </>
    );
};

export default Popover;
