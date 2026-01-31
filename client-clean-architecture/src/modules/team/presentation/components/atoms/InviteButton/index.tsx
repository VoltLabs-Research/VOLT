import React from 'react';
import { Check, X } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';

export type InviteButtonState = 'idle' | 'success' | 'error';

interface InviteButtonProps {
    state: InviteButtonState;
    isLoading: boolean;
    onClick: () => void;
    disabled?: boolean;
};

const InviteButton: React.FC<InviteButtonProps> = ({
    state,
    isLoading,
    onClick,
    disabled = false
}) => {
    const getButtonContent = () => {
        switch (state) {
            case 'success':
                return {
                    text: 'Sent!',
                    icon: <Check size={18} />
                };
            case 'error':
                return {
                    text: 'Error',
                    icon: <X size={18} />
                };
            default:
                return {
                    text: 'Invite',
                    icon: undefined
                };
        }
    };

    const { text, icon } = getButtonContent();

    return (
        <Button
            variant='solid'
            intent='brand'
            onClick={onClick}
            disabled={disabled}
            isLoading={isLoading}
            leftIcon={icon}
        >
            {text}
        </Button>
    );
};

export default InviteButton;
