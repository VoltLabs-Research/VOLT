import { InviteButton } from '../InviteButton';
import type { InviteButtonState } from '../InviteButton';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import type { ChangeEvent, FormEvent } from 'react';
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
}

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
    const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await onSubmit();
    };

    return (
        <form className='invitation-email-input d-flex items-end gap-05' onSubmit={handleFormSubmit}>
            <FormFieldRHF
                autoFocus
                type='email'
                label='Invite by email'
                placeholder='Add people by email...'
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                error={error}
                disabled={isSubmitting || disabled}
                className='invitation-email-input-field'
            />
            <InviteButton
                state={buttonState}
                isLoading={isSubmitting}
                disabled={disabled}
                type='submit'
            />
        </form>
    );
};
