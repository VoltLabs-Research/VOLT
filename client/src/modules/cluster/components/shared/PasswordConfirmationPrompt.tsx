import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';

interface PasswordConfirmationPromptProps {
    description: string;
    password: string;
    error?: string;
    onPasswordChange: (password: string) => void;
}

const PasswordConfirmationPrompt = ({
    description,
    password,
    error,
    onPasswordChange
}: PasswordConfirmationPromptProps) => (
    <>
        <p className='text-sm text-muted'>
            {description}
        </p>
        <FormFieldRHF
            label='Password'
            type='password'
            value={password}
            error={error}
            onChange={(event) => onPasswordChange(event.target.value)}
        />
    </>
);

export default PasswordConfirmationPrompt;
