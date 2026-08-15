import { InviteButton } from '../InviteButton';
import type { InviteButtonState } from '@/modules/team/contracts/invite';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { ChangeEvent, FormEvent } from 'react';

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
        <form className='flex items-end gap-2 p-4 border-b border-border' onSubmit={handleFormSubmit}>
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
