import { useState } from 'react';
import { TbCheck, TbX } from 'react-icons/tb';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import useSSHUseCases from '@/modules/ssh/presentation/hooks/use-ssh-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';

interface TestResult {
    valid: boolean;
    error?: string;
};

interface SSHConnectionTestButtonProps {
    connectionId: string;
    disabled?: boolean;
};

const SSHConnectionTestButton = ({ connectionId, disabled }: SSHConnectionTestButtonProps) => {
    const { sshRepository } = useSSHUseCases();
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await showPromise(sshRepository.testConnection(connectionId), {
                loading: { title: 'Testing connection...' },
                success: { title: 'Connection successful!' },
                error: { title: 'Connection failed' }
            });
            setTestResult(result);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Connection failed';
            setTestResult({ valid: false, error: message });
        } finally {
            setIsTesting(false);
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
                disabled={disabled || isTesting}
                isLoading={isTesting}
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
