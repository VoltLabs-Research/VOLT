import Button from '@/shared/presentation/components/Button';
import { Check, X } from 'lucide-react';

export type InviteButtonState = 'idle' | 'success' | 'error';

interface InviteButtonProps {
    state: InviteButtonState;
    isLoading: boolean;
    onClick: () => void;
    disabled?: boolean;
};

export const InviteButton = ({
    state,
    isLoading,
    onClick,
    disabled = false
}: InviteButtonProps) => {
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
