import React, { ChangeEvent, KeyboardEvent } from 'react';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import InviteButton, { type InviteButtonState } from '../../atoms/InviteButton';
import './InvitationEmailInput.css';

interface InvitationEmailInputProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    onSubmit: () => Promise<void>;
    error?: string;
    isSubmitting: boolean;
    buttonState: InviteButtonState;
    disabled?: boolean;
};

const InvitationEmailInput: React.FC<InvitationEmailInputProps> = ({
    value,
    onChange,
    onBlur,
    onSubmit,
    error,
    isSubmitting,
    buttonState,
    disabled = false
}) => {
    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if(e.key === 'Enter'){
            e.preventDefault();
            void onSubmit();
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
                onClick={() => {
                    void onSubmit();
                }}
                disabled={disabled}
            />
        </Container>
    );
};

export default InvitationEmailInput;
