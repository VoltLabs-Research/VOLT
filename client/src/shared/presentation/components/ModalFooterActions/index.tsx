import { Button } from '@/shared/presentation/primitives';
import type { ButtonProps } from '@/shared/presentation/primitives';
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
    defaults: Pick<ButtonProps, 'variant' | 'intent'>
) => {
    if (!action) {
        return null;
    }

    const { label, variant, intent, ...props } = action;

    return (
        <Button
            variant={variant ?? defaults.variant}
            intent={intent ?? defaults.intent}
            {...props}
        >
            {label}
        </Button>
    );
};

const ModalFooterActions = ({ primary, secondary }: ModalFooterActionsProps) => {
    return (
        <>
            {renderAction(secondary, { variant: 'ghost', intent: 'neutral' })}
            {renderAction(primary, { variant: 'solid', intent: 'brand' })}
        </>
    );
};

export default ModalFooterActions;
