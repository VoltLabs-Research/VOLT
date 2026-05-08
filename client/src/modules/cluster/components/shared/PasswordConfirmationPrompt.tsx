import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Text from '@/shared/presentation/primitives/Text';

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
        <Text as='p' size='md' tone='secondary'>
            {description}
        </Text>
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
