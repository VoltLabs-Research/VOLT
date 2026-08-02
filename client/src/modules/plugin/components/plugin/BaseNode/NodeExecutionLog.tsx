import { Box, Row, Tag, Text } from '@voltstack/bravais';
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
        <Box position='absolute' overflow='hidden' zIndex='5' className='center-x workflow-node-exec-log nowheel' onClick={(event) => event.stopPropagation()}>
            <Row gap='025' className='color-secondary workflow-node-exec-log-header'>
                <Terminal size={10} />
                <Text as='p' size='sm' weight='bold'>Execution Log</Text>
                {exitCode !== undefined && (
                    <Tag
                        size='xs'
                        tone={exitCode === 0 ? 'success' : 'danger'}
                        className='font-mono workflow-node-exec-log-exit'
                    >
                        exit {exitCode}
                    </Tag>
                )}
            </Row>
            <pre className='m-0 p-05 y-auto workflow-node-exec-log-content'>
                {logSegments.length > 0 ? (
                    logSegments.map((segment, index) => (
                        <span
                            key={`${segment.occurredAt}-${index}`}
                            className={`workflow-node-exec-log-chunk workflow-node-exec-log-chunk--${segment.stream}`}
                        >
                            {segment.text}
                        </span>
                    ))
                ) : (
                    <>
                        {stdout && (
                            <span className='workflow-node-exec-log-stdout'>{stdout}</span>
                        )}
                        {stderr && (
                            <span className='workflow-node-exec-log-stderr'>{stderr}</span>
                        )}
                        {!stdout && !stderr && (
                            <span className='workflow-node-exec-log-empty'>Waiting for output...</span>
                        )}
                    </>
                )}
            </pre>
        </Box>
    );
};

export default NodeExecutionLog;
