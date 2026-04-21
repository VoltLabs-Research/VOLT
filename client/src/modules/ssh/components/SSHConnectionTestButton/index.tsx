import { useTestSSHConnectionMutation } from '@/modules/ssh/hooks/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import Button from '@/shared/presentation/components/Button';
import { useId, useState } from 'react';
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

enum ConnectionTestStateStatus {
    Idle = 'idle',
    Loading = 'loading',
    Success = 'success',
    Error = 'error'
};

interface ConnectionTestState {
    status: ConnectionTestStateStatus;
    message: string;
};

const SSHConnectionTestButton = ({ connectionId, disabled }: SSHConnectionTestButtonProps) => {
    const testConnection = useTestSSHConnectionMutation();
    const statusId = useId();
    const [testState, setTestState] = useState<ConnectionTestState>({
        status: ConnectionTestStateStatus.Idle,
        message: ''
    });
    let testResultContent: ReactNode = null;

    if (testState.status !== ConnectionTestStateStatus.Idle) {
        let testResultClassName = 'color-red';
        let testResultMessage = testState.message;
        let testResultIcon: ReactNode = <TbX size={16} />;

        if (testState.status === ConnectionTestStateStatus.Loading) {
            testResultClassName = 'color-muted';
            testResultIcon = null;
        }

        if (testState.status === ConnectionTestStateStatus.Success) {
            testResultClassName = 'color-green';
            testResultIcon = <TbCheck size={16} />;
        }

        testResultContent = (
            <div id={statusId} className={`volt-container d-flex items-center gap-05 font-size-2 ${testResultClassName}`} role='status' aria-live='polite' aria-atomic='true'>
                {testResultIcon && <span aria-hidden='true'>{testResultIcon}</span>}
                <span>{testResultMessage}</span>
            </div>
        );
    }

    const resolveTestState = (result: TestResult): ConnectionTestState => {
        if (result.valid) {
            return {
                status: ConnectionTestStateStatus.Success,
                message: 'Connection successful'
            };
        }

        return {
            status: ConnectionTestStateStatus.Error,
            message: result.error || 'Connection failed'
        };
    };

    const handleTest = async () => {
        setTestState({
            status: ConnectionTestStateStatus.Loading,
            message: 'Testing connection…'
        });

        try {
            const result = await showPromise(testConnection.mutateAsync({ sshConnectionId: connectionId }), {
                loading: { title: 'Testing connection...' },
                success: { title: 'Connection successful!' },
                error: { title: 'Connection failed' }
            });
            setTestState(resolveTestState(result));
        } catch (err: unknown) {
            if (isAccessDeniedError(err)) {
                const userError = reportError(err, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to test this connection'
                });
                setTestState({
                    status: ConnectionTestStateStatus.Error,
                    message: userError.title
                });
                return;
            }

            const message = err instanceof Error ? err.message : 'Connection failed';
            setTestState({
                status: ConnectionTestStateStatus.Error,
                message
            });
        }
    };

    return (
        <div className='volt-container d-flex items-center gap-1'>
            <Button
                type='button'
                variant='outline'
                intent='neutral'
                size='sm'
                onClick={handleTest}
                disabled={disabled || testConnection.isPending}
                isLoading={testConnection.isPending}
                aria-describedby={testState.status === ConnectionTestStateStatus.Idle ? undefined : statusId}
            >
                Test Connection
            </Button>
            {testResultContent}
        </div>
    );
};

export default SSHConnectionTestButton;
