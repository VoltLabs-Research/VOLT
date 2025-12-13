import React, { useEffect, useState } from 'react';
import containerApi from '@/services/api/container';
import { RefreshCw, Activity } from 'lucide-react';
import './ContainerProcesses.css';

interface ContainerProcessesProps {
    containerId: string;
}

const ContainerProcesses: React.FC<ContainerProcessesProps> = ({ containerId }) => {
    const [processes, setProcesses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProcesses = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await containerApi.getProcesses(containerId) as any;
            // containerApi.getProcesses returns the processes object directly
            // with { Titles: string[], Processes: string[][] }

            const mapped = (data?.Processes || []).map((p: string[]) => {
                // p indices correspond to: 0:PID, 1:COMM, 2:ARGS, 3:NLWP, 4:USER, 5:RSS, 6:PCPU
                return {
                    PID: p[0],
                    Program: p[1],
                    Command: p[2],
                    Threads: p[3],
                    User: p[4],
                    MemB: formatMemory(p[5]), // RSS is usually in KB
                    Cpu: p[6]
                };
            });

            setProcesses(mapped);
        } catch (err: any) {
            setError('Failed to load processes. Container might be stopped.');
        } finally {
            setLoading(false);
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
        fetchProcesses();
        const interval = setInterval(fetchProcesses, 3000);
        return () => clearInterval(interval);
    }, [containerId]);

    if (loading && processes.length === 0) {
        return <div className="processes-loading">Loading processes...</div>;
    }

    if (error) {
        return (
            <div className="processes-error">
                <Activity size={48} />
                <p>{error}</p>
                <button onClick={fetchProcesses} className="retry-btn">Retry</button>
            </div>
        );
    }

    return (
        <div className="processes-container">
            <div className="processes-header">
                <h3>Running Processes</h3>
                <button onClick={fetchProcesses} className="refresh-btn">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>
            <div className="processes-table-wrapper">
                <table className="processes-table">
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
                                <td className="program-cell">{proc.Program}</td>
                                <td className="monospace command-cell" title={proc.Command}>{proc.Command}</td>
                                <td className="monospace">{proc.Threads}</td>
                                <td>{proc.User}</td>
                                <td className="monospace">{proc.MemB}</td>
                                <td className="monospace">{proc.Cpu}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ContainerProcesses;
