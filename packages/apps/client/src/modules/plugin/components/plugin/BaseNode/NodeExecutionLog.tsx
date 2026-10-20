import { Chip } from '@heroui/react';
import Scrollable from '@/shared/ui/components/Scrollable';
import { Terminal } from 'lucide-react';
import type { DebugExecutionLogSegment } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import type { ReactNode } from 'react';

interface NodeExecutionLogProps {
    logSegments: DebugExecutionLogSegment[];

    output?: Record<string, unknown>;
}

const renderOutputStream = (value: unknown): ReactNode => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    return JSON.stringify(value, null, 2);
};

const NodeExecutionLog = ({ logSegments, output }: NodeExecutionLogProps) => {
    const streamClass: Record<DebugExecutionLogSegment['stream'], string | null> = {
        stdout: null,
        stderr: 'text-danger',
        system: 'text-accent'
    };

    const exitCode = typeof output?.exitCode === 'number' ? output.exitCode : undefined;
    const stdout = renderOutputStream(output?.stdout);
    const stderr = renderOutputStream(output?.stderr);

    return (
        <div className='absolute left-1/2 top-[calc(100%+2rem)] z-[5] w-[300px] -translate-x-1/2 overflow-hidden rounded-md border border-border bg-surface-secondary nowheel' onClick={(event) => event.stopPropagation()}>
            <div className='flex flex-row items-center gap-1 border-b border-border px-2 py-1.5 text-muted'>
                <Terminal size={10} aria-hidden='true' />
                <p className='text-xs font-semibold'>Execution Log</p>
                {exitCode !== undefined && (
                    <Chip
                        size='sm'
                        variant='soft'
                        color={exitCode === 0 ? 'success' : 'danger'}
                        className='ml-auto rounded-full font-mono text-2xs'
                    >
                        exit {exitCode}
                    </Chip>
                )}
            </div>
            <Scrollable className='max-h-[220px] p-2'>
                <pre className='m-0 whitespace-pre-wrap break-words font-mono text-2xs leading-[1.6]'>
                    {logSegments.length > 0 ? (
                        logSegments.map((segment, index) => (
                            <span
                                key={`${segment.occurredAt}-${index}`}
                                className={streamClass[segment.stream] ?? undefined}
                            >
                                {segment.text}
                            </span>
                        ))
                    ) : (
                        <>
                            {stdout && (
                                <span className='text-foreground'>{stdout}</span>
                            )}
                            {stderr && (
                                <span className='text-danger'>{stderr}</span>
                            )}
                            {!stdout && !stderr && (
                                <span className='italic text-muted'>Waiting for output...</span>
                            )}
                        </>
                    )}
                </pre>
            </Scrollable>
        </div>
    );
};

export default NodeExecutionLog;
