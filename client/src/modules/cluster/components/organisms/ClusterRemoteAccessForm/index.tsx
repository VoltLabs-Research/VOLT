import { getTeamClusterRemoteAccessDescription, getTeamClusterRemoteAccessLabel } from '@/modules/cluster/utilities/team-cluster-remote-access';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useState } from 'react';
import type { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterRemoteAccessFormProps {
    target: TeamClusterRemoteAccessTarget;
    clusterName: string;
    isLoading: boolean;
    error: string | null;
    onSubmit: (password: string) => void;
};

const ClusterRemoteAccessForm = ({
    target,
    clusterName,
    isLoading,
    error,
    onSubmit
}: ClusterRemoteAccessFormProps) => {
    const [password, setPassword] = useState('');
    const [validationError, setValidationError] = useState<string | undefined>();

    const actionLabel = getTeamClusterRemoteAccessLabel(target);
    const actionDescription = getTeamClusterRemoteAccessDescription(target);

    const handleSubmit = () => {
        if (!password.trim()) {
            setValidationError('Password confirmation is required');
            return;
        }

        setValidationError(undefined);
        onSubmit(password);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    const displayError = validationError || error || undefined;

    return (
        <Container className='d-flex column items-center content-center flex-1 gap-1-5 p-2'>
            <Container className='d-flex column gap-05' style={{ maxWidth: 420, width: '100%' }}>
                <Title className='font-size-5 font-weight-6 color-primary'>
                    {actionLabel} · {clusterName}
                </Title>
                <Paragraph className='font-size-2 color-secondary'>
                    {actionDescription}
                </Paragraph>
            </Container>

            <Container className='d-flex column gap-1' style={{ maxWidth: 420, width: '100%' }}>
                <Paragraph className='font-size-2 color-secondary'>
                    Remote access is sensitive. Confirm your password before opening this cluster resource.
                </Paragraph>

                <FormFieldRHF
                    label='Password'
                    type='password'
                    value={password}
                    error={displayError}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        if (validationError) {
                            setValidationError(undefined);
                        }
                    }}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />

                <Button
                    variant='solid'
                    intent='brand'
                    isLoading={isLoading}
                    onClick={handleSubmit}
                >
                    {actionLabel}
                </Button>
            </Container>
        </Container>
    );
};

export default ClusterRemoteAccessForm;
