import { useTestSSHConnectionMutation } from '@/modules/ssh/hooks/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { useState } from 'react';
import { TbCheck, TbX } from 'react-icons/tb';
import type { ReactNode } from 'react';

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
    let testResultContent: ReactNode = null;

    if (testResult) {
        let testResultClassName = 'color-red';
        let testResultMessage = testResult.error || 'Connection failed';
        let testResultIcon = <TbX size={16} />;

        if (testResult.valid) {
            testResultClassName = 'color-green';
            testResultMessage = 'Connection successful';
            testResultIcon = <TbCheck size={16} />;
        }

        testResultContent = (
            <Container className={`d-flex items-center gap-05 font-size-2 ${testResultClassName}`}>
                {testResultIcon}
                <span>{testResultMessage}</span>
            </Container>
        );
    }

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
            if (isAccessDeniedError(err)) {
                const userError = reportError(err, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to test this connection'
                });
                setTestResult({
                    valid: false,
                    error: userError.title
                });
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
            {testResultContent}
        </Container>
    );
};

export default SSHConnectionTestButton;
