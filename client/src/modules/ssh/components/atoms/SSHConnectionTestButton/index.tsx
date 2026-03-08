import { useState } from 'react';
import { TbCheck, TbX } from 'react-icons/tb';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { useTestSSHConnectionMutation } from '@/modules/ssh/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';

interface TestResult {
    valid: boolean;
    error?: string;
};

interface SSHConnectionTestButtonProps {
    connectionId: string;
    disabled?: boolean;
};

const SSHConnectionTestButton = ({ connectionId, disabled }: SSHConnectionTestButtonProps) => {
    const testConnection = useTestSSHConnectionMutation();
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const handleTest = async () => {
        setTestResult(null);
        try {
            const result = await showPromise(testConnection.mutateAsync({ sshConnectionId: connectionId }), {
                loading: { title: 'Testing connection...' },
                success: { title: 'Connection successful!' },
                error: { title: 'Connection failed' }
            });
            setTestResult(result);
        } catch (err: unknown) {
            if(ApiError.isRBACError(err)){
                const msg = err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to test this connection';
                setTestResult({ valid: false, error: msg });
                return;
            }
            const message = err instanceof Error ? err.message : 'Connection failed';
            setTestResult({ valid: false, error: message });
        }
    };

    return (
        <Container className='d-flex items-center gap-1'>
            <Button
                type='button'
                variant='outline'
                intent='neutral'
                size='sm'
                onClick={handleTest}
                disabled={disabled || testConnection.isPending}
                isLoading={testConnection.isPending}
            >
                Test Connection
            </Button>
            {testResult && (
                <Container className={`d-flex items-center gap-05 font-size-2 ${testResult.valid ? 'color-green' : 'color-red'}`}>
                    {testResult.valid ? (
                        <>
                            <TbCheck size={16} />
                            <span>Connection successful</span>
                        </>
                    ) : (
                        <>
                            <TbX size={16} />
                            <span>{testResult.error || 'Connection failed'}</span>
                        </>
                    )}
                </Container>
            )}
        </Container>
    );
};

export default SSHConnectionTestButton;
