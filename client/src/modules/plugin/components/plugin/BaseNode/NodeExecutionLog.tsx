import { Chip, cn } from '@heroui/react';
import {
    EXEC_LOG_CHUNK_CLASS,
    EXEC_LOG_CLASS,
    EXEC_LOG_CONTENT_CLASS,
    EXEC_LOG_EMPTY_CLASS,
    EXEC_LOG_EXIT_CLASS,
    EXEC_LOG_HEADER_CLASS,
    EXEC_LOG_STDERR_CLASS,
    EXEC_LOG_STDOUT_CLASS
} from '@/modules/plugin/components/plugin/BaseNode/node-styles';
import { Terminal } from 'lucide-react';
import type { DebugExecutionLogSegment } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import type { ReactNode } from 'react';

interface NodeExecutionLogProps {
    logSegments: DebugExecutionLogSegment[];
    /** Untyped bag of whatever the executed node returned. */
    output?: Record<string, unknown>;
}

/**
 * Renders one of the loosely typed fields a node execution reports, which may be
 * anything the plugin decided to write.
 */
const renderOutputStream = (value: unknown): ReactNode => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    return JSON.stringify(value, null, 2);
};

/**
 * Terminal-style overlay streaming a node's stdout/stderr while it runs, falling
 * back to the output it reported once it has finished.
 */
const NodeExecutionLog = ({ logSegments, output }: NodeExecutionLogProps) => {
    const exitCode = typeof output?.exitCode === 'number' ? output.exitCode : undefined;
    const stdout = renderOutputStream(output?.stdout);
    const stderr = renderOutputStream(output?.stderr);

    return (
        <div className={cn(EXEC_LOG_CLASS, 'nowheel')} onClick={(event) => event.stopPropagation()}>
            <div className={EXEC_LOG_HEADER_CLASS}>
                <Terminal size={10} aria-hidden='true' />
                <p className='text-xs font-semibold'>Execution Log</p>
                {exitCode !== undefined && (
                    <Chip
                        size='sm'
                        variant='soft'
                        color={exitCode === 0 ? 'success' : 'danger'}
                        className={EXEC_LOG_EXIT_CLASS}
                    >
                        exit {exitCode}
                    </Chip>
                )}
            </div>
            <pre className={EXEC_LOG_CONTENT_CLASS}>
                {logSegments.length > 0 ? (
                    logSegments.map((segment, index) => (
                        <span
                            key={`${segment.occurredAt}-${index}`}
                            className={EXEC_LOG_CHUNK_CLASS[segment.stream] ?? undefined}
                        >
                            {segment.text}
                        </span>
                    ))
                ) : (
                    <>
                        {stdout && (
                            <span className={EXEC_LOG_STDOUT_CLASS}>{stdout}</span>
                        )}
                        {stderr && (
                            <span className={EXEC_LOG_STDERR_CLASS}>{stderr}</span>
                        )}
                        {!stdout && !stderr && (
                            <span className={EXEC_LOG_EMPTY_CLASS}>Waiting for output...</span>
                        )}
                    </>
                )}
            </pre>
        </div>
    );
};

export default NodeExecutionLog;
