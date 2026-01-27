import React, { useEffect, useState } from 'react';
import { getContainerUseCases } from '@/modules/container/application/registry';
import { RefreshCw, Activity } from 'lucide-react';
import Container from '@/shared/presentation/components/primitives/Container';
import Button from '@/shared/presentation/components/primitives/Button';
import '@/modules/container/presentation/components/organisms/ContainerProcesses/ContainerProcesses.css';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Title from '@/shared/presentation/components/primitives/Title';

interface ContainerProcessesProps {
    containerId: string;
}

const ContainerProcesses: React.FC<ContainerProcessesProps> = ({ containerId }) => {
    const [processes, setProcesses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { getContainerProcessesUseCase } = getContainerUseCases();

    const fetchProcesses = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            const data = await getContainerProcessesUseCase.execute(containerId) as any;
            const mapped = data.map((p: string[]) => {
                // Backend ps_args: '-o pid,comm,nlwp,user,rss,pcpu,args'
                // p[0]: PID, p[1]: COMM, p[2]: NLWP, p[3]: USER, p[4]: RSS, p[5]: PCPU, p[6+]: ARGS
                return {
                    PID: p[0],
                    Program: p[1],
                    Threads: p[2],
                    User: p[3],
                    MemB: formatMemory(p[4]),
                    Cpu: p[5],
                    Command: p.slice(6).join(' ') // Join remaining parts as command
                };
            });


            setProcesses(mapped);
        } catch (err: any) {
            if (processes.length === 0) {
                setError('Failed to load processes. Container might be stopped.');
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const formatMemory = (kbStr: string) => {
        const kb = parseInt(kbStr, 10);
        if (isNaN(kb)) return kbStr;
        if (kb > 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)}G`;
        if (kb > 1024) return `${(kb / 1024).toFixed(0)}M`;
        return `${kb}K`;
    };

    useEffect(() => {
        fetchProcesses(false);
        const interval = setInterval(() => fetchProcesses(true), 3000);
        return () => clearInterval(interval);
    }, [containerId]);

    if (loading && processes.length === 0) {
        return (
            <Container className='d-flex column flex-center h-max color-muted-foreground gap-1 p-2 text-center'>
                Loading processes...
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="d-flex column flex-center h-max gap-1 p-2 text-center color-muted-foreground">
                <Activity size={48} />
                <Paragraph>{error}</Paragraph>
                <Button variant='ghost' intent='neutral' size='sm' onClick={() => fetchProcesses(false)}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container className="d-flex h-max column overflow-hidden processes-container">
            <Container className="d-flex content-between items-center processes-header p-1">
                <Title className='font-size-3'>Running Processes</Title>
                <Button variant='ghost' intent='neutral' size='sm' leftIcon={<RefreshCw size={14} />} onClick={() => fetchProcesses(false)}>
                    Refresh
                </Button>
            </Container>
            <Container className="flex-1 overflow-auto">
                <table className="processes-table w-max font-size-2">
                    <thead>
                        <tr>
                            <th>PID</th>
                            <th>Program</th>
                            <th>Command</th>
                            <th>Threads</th>
                            <th>User</th>
                            <th>MemB</th>
                            <th>Cpu%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processes.map((proc, i) => (
                            <tr key={i}>
                                <td className="monospace">{proc.PID}</td>
                                <td className="program-cell font-weight-5">{proc.Program}</td>
                                <td className="monospace command-cell overflow-hidden color-muted-foreground" title={proc.Command}>{proc.Command}</td>
                                <td className="monospace">{proc.Threads}</td>
                                <td>{proc.User}</td>
                                <td className="monospace">{proc.MemB}</td>
                                <td className="monospace">{proc.Cpu}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Container>
        </Container>
    );
};

export default ContainerProcesses;
