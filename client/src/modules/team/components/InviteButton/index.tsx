import { Button, Spinner } from '@heroui/react';
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

/**
 * `min-h-11` is `InvitationEmailInput.css`'s `.invitation-email-input button
 * { min-height: 2.75rem }` — a rule that only ever matched this button, lining the
 * commit button up with the field beside it. It sits here rather than at the call
 * site because HeroUI's `Button` prop interface is closed and this is its only use.
 *
 * `onClick` / `isLoading` / `disabled` stay this component's own prop names — they
 * are its API, not HeroUI's — and are mapped to `onPress` / `isPending` /
 * `isDisabled` here.
 */
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
            variant='primary'
            className='min-h-11'
            onPress={onClick}
            isDisabled={disabled}
            isPending={isLoading}
            type={type}
        >
            {isLoading ? <Spinner size='sm' color='current' /> : icon}
            {text}
        </Button>
    );
};
