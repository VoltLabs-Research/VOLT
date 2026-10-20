import { Button } from '@heroui/react';
import type { ButtonProps } from '@heroui/react';
import type { ReactNode } from 'react';

export interface ModalFooterAction extends Omit<ButtonProps, 'children'> {
    label: ReactNode;
};

interface ModalFooterActionsProps {
    primary?: ModalFooterAction;
    secondary?: ModalFooterAction;
};

const renderAction = (
    action: ModalFooterAction | undefined,
    defaultVariant: ButtonProps['variant']
) => {
    if (!action) {
        return null;
    }

    const { label, variant, ...props } = action;

    return (
        <Button variant={variant ?? defaultVariant} {...props}>
            {label}
        </Button>
    );
};

const ModalFooterActions = ({ primary, secondary }: ModalFooterActionsProps) => {
    return (
        <>
            {renderAction(secondary, 'ghost')}
            {renderAction(primary, 'primary')}
        </>
    );
};

export default ModalFooterActions;
