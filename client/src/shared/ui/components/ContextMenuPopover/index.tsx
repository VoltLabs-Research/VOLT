import { cn } from '@heroui/react';
import AsyncContextMenuItem from './AsyncContextMenuItem';
import ContextMenuList from './ContextMenuList';
import SubmenuItemWrapper from './SubmenuItemWrapper';
import FloatingRootContext, {
    FloatingOwnerIdsContext,
    appendFloatingOwnerIds,
    hasFloatingOwnerId,
    useFloatingOwnerIds,
    useFloatingRoot
} from '@/shared/ui/contexts/FloatingRootContext';
import composeRefs from '@/shared/ui/utils/compose-refs';
import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from '@floating-ui/react';
import { cloneElement, isValidElement, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import type { MouseEvent, ReactElement, ReactNode, Ref } from 'react';
import type { Placement } from '@floating-ui/react';

type ContextMenuOpenPredicate = (event: MouseEvent<Element>) => boolean;
type ContextMenuContent = ReactNode | ((close: () => void) => ReactNode);
type ContextMenuTriggerElement = ReactElement<{ ref?: Ref<HTMLElement> } & Record<string, unknown>>;

interface ContextMenuPopoverProps {
    id: string;
    trigger: ReactNode;
    options?: MenuOption[];
    content?: ContextMenuContent;
    size?: 'sm' | 'md';
    triggerAction?: 'click' | 'contextmenu';
    shouldOpenOnContextMenu?: ContextMenuOpenPredicate;
    ariaLabel?: string;
    menuLabel?: string;
    placement?: Placement;
    className?: string;
};

interface ContextMenuPosition {
    x: number;
    y: number;
};

/**
 * `overflow-visible` used to be `.context-menu-popover { overflow: visible }`
 * overriding bravais's `.popover { overflow-y: auto }`, and it is load-bearing:
 * SubmenuItemWrapper portals its panel *into* this element, so a clipping
 * overflow would cut every submenu off at the parent's edge.
 */
const PANEL_CLASS_NAMES = 'z-[99999] max-w-[320px] overflow-visible rounded-xl border border-border bg-overlay text-foreground shadow-lg';

const PANEL_SIZE_CLASS_NAMES: Record<'sm' | 'md', string> = {
    sm: 'min-w-[124px]',
    md: 'min-w-[180px]'
};

const CONTENT_SIZE_CLASS_NAMES: Record<'sm' | 'md', string> = {
    sm: 'min-w-[180px]',
    md: 'min-w-[min(22rem,calc(100vw-2rem))]'
};

const isTriggerElement = (node: ReactNode): node is ContextMenuTriggerElement => {
    return isValidElement(node);
};

const ContextMenuPopover = ({
    id,
    trigger,
    options = [],
    content,
    size = 'md',
    triggerAction = 'contextmenu',
    shouldOpenOnContextMenu,
    ariaLabel = 'Context menu',
    menuLabel = 'Context menu actions',
    placement = 'bottom-start',
    className = ''
}: ContextMenuPopoverProps) => {
    const [menuError, setMenuError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
    const [floatingElement, setFloatingElement] = useState<HTMLElement | null>(null);
    const floatingRoot = useFloatingRoot();
    const floatingOwnerIds = useFloatingOwnerIds();
    const nextFloatingOwnerIds = useMemo(() => appendFloatingOwnerIds(floatingOwnerIds, id), [floatingOwnerIds, id]);
    const hasCustomContent = content !== undefined;
    const popoverRole = hasCustomContent ? 'dialog' : 'menu';

    // Held in a ref, and read through the ref inside handleOpenChange, so that
    // handleOpenChange stays referentially stable: putting the callback straight
    // into the dep array re-runs floating-ui's autoUpdate on every parent render.
    const onOpenChangeRef = useRef<((isOpen: boolean) => void) | null>(null);
    onOpenChangeRef.current = (nextOpen: boolean) => {
        if (!nextOpen) {
            setMenuError(null);
        }
    };

    const handleOpenChange = useCallback((nextOpen: boolean) => {
        setIsOpen(nextOpen);

        if (!nextOpen) {
            setContextMenuPosition(null);
        }

        onOpenChangeRef.current?.(nextOpen);
    }, []);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: handleOpenChange,
        placement,
        middleware: [
            offset(8),
            flip({ padding: 16 }),
            shift({ padding: 16 })
        ],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context, { enabled: triggerAction === 'click' });
    const dismiss = useDismiss(context, {
        outsidePress: (event) => !hasFloatingOwnerId(event.target instanceof Element ? event.target : null, id)
    });
    const role = useRole(context, { role: popoverRole });
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

    const { setPositionReference, domReference } = refs;

    useLayoutEffect(() => {
        if (!contextMenuPosition) {
            setPositionReference(domReference.current);
            return;
        }

        const { x, y } = contextMenuPosition;

        setPositionReference({
            getBoundingClientRect: () => new DOMRect(x, y, 0, 0)
        });
    }, [contextMenuPosition, domReference, setPositionReference]);

    const handleFloatingRef = useCallback((node: HTMLElement | null) => {
        refs.setFloating(node);
        setFloatingElement(node);
    }, [refs]);

    const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

    const handleContextMenu = (event: MouseEvent<Element>) => {
        if (triggerAction !== 'contextmenu') {
            return;
        }

        if (event.defaultPrevented) {
            return;
        }

        if (shouldOpenOnContextMenu && !shouldOpenOnContextMenu(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setContextMenuPosition({
            x: event.clientX,
            y: event.clientY
        });
        handleOpenChange(true);
    };

    if (options.length === 0 && !hasCustomContent) {
        return <>{trigger}</>;
    }

    const renderOption = (option: MenuOption, index: number) => {
        const key = `${id}-${option.label}-${index}`;

        if (option.submenuContent) {
            return (
                <SubmenuItemWrapper
                    key={key}
                    option={option}
                    size={size}
                    onOpen={() => setMenuError(null)}
                />
            );
        }

        return (
            <AsyncContextMenuItem
                key={key}
                option={option}
                size={size}
                onClose={close}
                onError={setMenuError}
            />
        );
    };

    const triggerElement = isTriggerElement(trigger)
        ? cloneElement(trigger, {
            ...(triggerAction === 'contextmenu'
                ? {}
                : { ref: composeRefs(refs.setReference, trigger.props.ref) }),
            'data-popover-trigger': id,
            'aria-controls': isOpen ? id : undefined,
            'aria-expanded': triggerAction === 'click' ? isOpen : undefined,
            'aria-haspopup': hasCustomContent ? 'dialog' : 'menu',
            ...getReferenceProps({ onContextMenu: handleContextMenu })
        })
        : null;

    return (
        <>
            {triggerElement}

            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <FloatingFocusManager context={context} modal={false}>
                        <div
                            ref={handleFloatingRef}
                            id={id}
                            className={cn(
                                PANEL_CLASS_NAMES,
                                PANEL_SIZE_CLASS_NAMES[size],
                                className
                            )}
                            style={floatingStyles}
                            data-context-menu-panel='true'
                            onClick={(event) => event.stopPropagation()}
                            aria-label={ariaLabel}
                            tabIndex={-1}
                            {...getFloatingProps()}
                        >
                            <FloatingOwnerIdsContext.Provider value={nextFloatingOwnerIds}>
                                <FloatingRootContext.Provider value={floatingElement ?? floatingRoot}>
                                    {hasCustomContent ? (
                                        <div className={cn('flex flex-col p-2', CONTENT_SIZE_CLASS_NAMES[size])}>
                                            {typeof content === 'function' ? content(close) : content}
                                        </div>
                                    ) : (
                                        <ContextMenuList label={menuLabel} size={size} onClose={close}>
                                            {menuError && (
                                                <p className='px-2 pb-2 pt-1 text-xs text-danger' role='status' aria-live='polite' aria-atomic='true'>
                                                    {menuError}
                                                </p>
                                            )}
                                            {options.map(renderOption)}
                                        </ContextMenuList>
                                    )}
                                </FloatingRootContext.Provider>
                            </FloatingOwnerIdsContext.Provider>
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
};

export default ContextMenuPopover;
