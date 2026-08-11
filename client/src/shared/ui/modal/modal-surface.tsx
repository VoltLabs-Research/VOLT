import {
    DrawerBody,
    DrawerCloseTrigger,
    DrawerContent,
    DrawerDialog,
    DrawerFooter,
    DrawerHeader,
    DrawerHeading,
    ModalBody,
    ModalCloseTrigger,
    ModalContainer,
    ModalDialog,
    ModalFooter,
    ModalHeader,
    ModalHeading
} from '@heroui/react';
import { ModalTopLayer } from '@/shared/ui/modal/top-layer';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface ModalSurfaceProps {
    dialogId: string;

    titleId?: string;

    descriptionId?: string;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;

    className?: string;

    dialogStyle?: CSSProperties;
    dismissible: boolean;
}

export const CenteredModalSurface = ({
    dialogId,
    titleId,
    descriptionId,
    title,
    description,
    children,
    footer,
    className,
    dialogStyle,
    dismissible
}: ModalSurfaceProps) => {
    const [topLayerRoot, setTopLayerRoot] = useState<HTMLDivElement | null>(null);
    const hasHeader = Boolean(title || description);
    const hasCloseTrigger = dismissible && hasHeader;

    return (
        <ModalContainer>
            <ModalDialog
                id={dialogId}
                className={className}
                style={dialogStyle}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <ModalTopLayer root={topLayerRoot}>
                    {hasCloseTrigger && <ModalCloseTrigger aria-label='Close modal' />}

                    {hasHeader && (
                        <ModalHeader className={hasCloseTrigger ? 'gap-1 pe-8' : 'gap-1'}>
                            {title && <ModalHeading id={titleId}>{title}</ModalHeading>}
                            {description && (
                                <p id={descriptionId} className='text-sm text-muted'>{description}</p>
                            )}
                        </ModalHeader>
                    )}

                    <ModalBody className='text-foreground'>{children}</ModalBody>

                    {footer && <ModalFooter>{footer}</ModalFooter>}
                </ModalTopLayer>
            </ModalDialog>
            <div ref={setTopLayerRoot} className='pointer-events-auto' />
        </ModalContainer>
    );
};

interface EdgeModalSurfaceProps extends ModalSurfaceProps {
    placement: 'right' | 'bottom';
}

export const EdgeModalSurface = ({
    dialogId,
    titleId,
    descriptionId,
    title,
    description,
    children,
    footer,
    className,
    dialogStyle,
    dismissible,
    placement
}: EdgeModalSurfaceProps) => {
    const [topLayerRoot, setTopLayerRoot] = useState<HTMLDivElement | null>(null);
    const hasHeader = Boolean(title || description);
    const hasCloseTrigger = dismissible && hasHeader;

    return (
        <DrawerContent placement={placement}>
            <DrawerDialog
                id={dialogId}
                className={className}
                style={dialogStyle}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <ModalTopLayer root={topLayerRoot}>
                    {hasCloseTrigger && <DrawerCloseTrigger aria-label='Close modal' />}

                    {hasHeader && (
                        <DrawerHeader className={hasCloseTrigger ? 'gap-1 pe-8' : 'gap-1'}>
                            {title && <DrawerHeading id={titleId}>{title}</DrawerHeading>}
                            {description && (
                                <p id={descriptionId} className='text-sm text-muted'>{description}</p>
                            )}
                        </DrawerHeader>
                    )}

                    <DrawerBody className='text-foreground'>{children}</DrawerBody>

                    {footer && <DrawerFooter>{footer}</DrawerFooter>}
                </ModalTopLayer>
            </DrawerDialog>
            <div ref={setTopLayerRoot} className='pointer-events-auto' />
        </DrawerContent>
    );
};
