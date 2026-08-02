import { Button } from '@voltstack/bravais';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type InviteButtonState = 'idle' | 'success' | 'error';

const BUTTON_CONTENT: Record<InviteButtonState, { text: string; icon?: ReactNode }> = {
    idle: { text: 'Invite' },
    success: {
        text: 'Sent!',
        icon: <Check size={18} />
    },
    error: {
        text: 'Error',
        icon: <X size={18} />
    }
};

interface InviteButtonProps {
    state: InviteButtonState;
    isLoading: boolean;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit';
}

export const InviteButton = ({
    state,
    isLoading,
    onClick,
    disabled = false,
    type = 'button'
}: InviteButtonProps) => {
    const { text, icon } = BUTTON_CONTENT[state];

    return (
        <Button
            variant='solid'
            intent='brand'
            onClick={onClick}
            disabled={disabled}
            isLoading={isLoading}
            leftIcon={icon}
            type={type}
        >
            {text}
        </Button>
    );
};
