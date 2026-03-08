import { InviteButton } from '../../atoms/InviteButton';
import type { InviteButtonState } from '../../atoms/InviteButton';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import type { ChangeEvent, KeyboardEvent } from 'react';
import './InvitationEmailInput.css';

interface InvitationEmailInputProps {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    onSubmit: () => Promise<void>;
    error?: string;
    isSubmitting: boolean;
    buttonState: InviteButtonState;
    disabled?: boolean;
};

export const InvitationEmailInput = ({
    value,
    onChange,
    onBlur,
    onSubmit,
    error,
    isSubmitting,
    buttonState,
    disabled = false
}: InvitationEmailInputProps) => {
    const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
        if(event.key === 'Enter'){
            event.preventDefault();
            onSubmit();
        }
    };

    return (
        <Container className='invitation-email-input d-flex items-center gap-05'>
            <FormFieldRHF
                autoFocus
                type='email'
                placeholder='Add people by email...'
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                inputProps={{ onKeyPress: handleKeyPress }}
                error={error}
                disabled={isSubmitting || disabled}
                className='invitation-email-input-field'
            />
            <InviteButton
                state={buttonState}
                isLoading={isSubmitting}
                onClick={onSubmit}
                disabled={disabled}
            />
        </Container>
    );
};
