import { cn } from '@heroui/react';
import Scrollable from '@/shared/ui/components/Scrollable';
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
        <div data-node-inspect className='glass-surface nowheel absolute left-1/2 top-[calc(100%+2.25rem)] z-[5] w-[300px] -translate-x-1/2 cursor-auto select-text overflow-hidden rounded-2xl bg-overlay shadow-[var(--overlay-shadow)]' onClick={(event) => event.stopPropagation()}>
            <div className='flex flex-row items-center justify-between gap-3 px-3.5 pt-2.5 pb-1 text-xs font-semibold text-muted'>
                <p>Execution Log</p>
                {exitCode !== undefined && (
                    <span className={cn('font-mono font-medium', exitCode === 0 ? 'text-success-soft-foreground' : 'text-danger-soft-foreground')}>
                        exit {exitCode}
                    </span>
                )}
            </div>
            <Scrollable className='max-h-[220px] px-3.5 pt-1 pb-3'>
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
