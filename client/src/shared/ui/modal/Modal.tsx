import { DrawerBackdrop, ModalBackdrop } from '@heroui/react';
import { CenteredModalSurface, EdgeModalSurface } from '@/shared/ui/modal/modal-surface';
import { getInitialFocusTarget } from '@/shared/ui/modal/initial-focus';
import { closeModal, openModal, useIsModalOpen } from '@/shared/ui/modal/use-modal-store';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

interface ModalProps {
    id: string;

    trigger?: ReactNode;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;

    className?: string;

    width?: string;

    onClose?: () => void;

    dismissible?: boolean;

    lazyMount?: boolean;

    placement?: 'center' | 'right' | 'bottom';
}

const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';

const DIALOG_SELECTOR = '[data-slot="modal-dialog"], [data-slot="drawer-dialog"]';

const BACKDROP_VARIANT = 'blur';

interface ModalPresentation {
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    width?: string;
    dismissible: boolean;
    placement: 'center' | 'right' | 'bottom';
}

export const Modal = ({
    id,
    trigger,
    title,
    description,
    children,
    footer,
    className,
    width,
    onClose,
    dismissible = true,
    placement = 'center'
}: ModalProps) => {
    const isOpen = useIsModalOpen(id);
    const isCoarsePointer = useMedia(COARSE_POINTER_MEDIA_QUERY);
    const [backdropElement, setBackdropElement] = useState<HTMLDivElement | null>(null);
    const restoreFocusElementRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(isOpen);

    const livePresentation: ModalPresentation = {
        title,
        description,
        children,
        footer,
        className,
        width,
        dismissible,
        placement
    };
    const heldPresentationRef = useRef(livePresentation);

    useLayoutEffect(() => {
        if (isOpen) {
            heldPresentationRef.current = livePresentation;
        }
    });

    useLayoutEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!restoreFocusElementRef.current && document.activeElement instanceof HTMLElement) {
            restoreFocusElementRef.current = document.activeElement;
        }
    }, [isOpen]);

    useEffect(() => {
        if (wasOpenRef.current === isOpen) {
            return;
        }

        wasOpenRef.current = isOpen;

        if (isOpen) {
            return;
        }

        onClose?.();

        const restoreFocusElement = restoreFocusElementRef.current;
        restoreFocusElementRef.current = null;

        if (restoreFocusElement?.isConnected) {
            restoreFocusElement.focus({ preventScroll: true });
        }
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !backdropElement) {
            return;
        }

        const dialogElement = backdropElement.querySelector<HTMLElement>(DIALOG_SELECTOR);
        if (!dialogElement) {
            return;
        }

        const focusFrame = window.requestAnimationFrame(() => {
            if (!dialogElement.isConnected) {
                return;
            }

            getInitialFocusTarget(dialogElement, isCoarsePointer).focus({ preventScroll: true });
        });

        return () => window.cancelAnimationFrame(focusFrame);
    }, [isOpen, backdropElement, isCoarsePointer]);

    const handleOpenChange = (nextIsOpen: boolean) => {
        if (nextIsOpen) {
            openModal(id);
            return;
        }

        closeModal(id);
    };

    const {
        title: paintedTitle,
        description: paintedDescription,
        children: paintedChildren,
        footer: paintedFooter,
        className: paintedClassName,
        width: paintedWidth,
        dismissible: paintedDismissible,
        placement: paintedPlacement
    } = isOpen ? livePresentation : heldPresentationRef.current;

    const titleId = paintedTitle ? `${id}-title` : undefined;
    const descriptionId = paintedDescription ? `${id}-description` : undefined;

    const dialogStyle: CSSProperties | undefined = paintedWidth
        ? {
            maxWidth: paintedWidth,
            touchAction: paintedPlacement === 'center' || !paintedDismissible ? undefined : 'none'
        }
        : undefined;

    const surfaceProps = {
        dialogId: id,
        titleId,
        descriptionId,
        title: paintedTitle,
        description: paintedDescription,
        footer: paintedFooter,
        className: paintedClassName,
        dialogStyle,
        dismissible: paintedDismissible,
        children: paintedChildren
    };

    const triggerElement = trigger && isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(trigger)
        ? cloneElement(trigger, {
            onClick: () => openModal(id),
            'aria-controls': id,
            'aria-haspopup': 'dialog',
            type: 'button'
        })
        : null;

    const backdropProps = {
        ref: setBackdropElement,
        variant: BACKDROP_VARIANT,
        isOpen,
        onOpenChange: handleOpenChange,
        isDismissable: paintedDismissible,
        isKeyboardDismissDisabled: !paintedDismissible
        // `as const` keeps `variant` as the literal `'blur'`; in a bare object
        // literal it would widen to `string` and stop matching the variant union.
    } as const;

    if (paintedPlacement === 'center') {
        return (
            <>
                {triggerElement}

                <ModalBackdrop {...backdropProps}>
                    <CenteredModalSurface {...surfaceProps} />
                </ModalBackdrop>
            </>
        );
    }

    return (
        <>
            {triggerElement}

            <DrawerBackdrop {...backdropProps}>
                <EdgeModalSurface {...surfaceProps} placement={paintedPlacement} />
            </DrawerBackdrop>
        </>
    );
};
