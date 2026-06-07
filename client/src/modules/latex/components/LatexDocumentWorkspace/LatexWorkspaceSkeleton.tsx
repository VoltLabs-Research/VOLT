import { Box, Row, Stack, Skeleton } from '@voltstack/bravais';

interface LoadingPlaceholderBlock {
    key: string;
    width: string;
}

interface LoadingSkeletonProps {
    width: string | number;
    height: string | number;
    borderRadius?: string | number;
}

interface LatexWorkspaceSkeletonProps {
    panelWidths: { files: number; preview: number; ai: number };
    isAIPanelOpen: boolean;
}

const LOADING_FILE_PANEL_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'file-1', width: '72%' },
    { key: 'file-2', width: '88%' },
    { key: 'file-3', width: '64%' },
    { key: 'file-4', width: '81%' }
];
const LOADING_EDITOR_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'editor-1', width: '94%' },
    { key: 'editor-2', width: '86%' },
    { key: 'editor-3', width: '91%' },
    { key: 'editor-4', width: '67%' }
];
const LOADING_PREVIEW_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'preview-1', width: '100%' },
    { key: 'preview-2', width: '100%' },
    { key: 'preview-3', width: '82%' }
];

const LoadingSkeleton = ({
    width,
    height,
    borderRadius = '999px'
}: LoadingSkeletonProps) => (
    <Skeleton
        variant='rectangular'
        animation='wave'
        width={width}
        height={height}
        style={{
            borderRadius,
            backgroundColor: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
        }}
    />
);

const LatexWorkspaceSkeleton = ({ panelWidths, isAIPanelOpen }: LatexWorkspaceSkeletonProps) => (
    <Stack className='latex-workspace'>
        <Row justify='between' gap='1' className='latex-workspace__toolbar'>
            <Stack gap='025'>
                <LoadingSkeleton width='13rem' height='1rem' />
                <LoadingSkeleton width='18rem' height='0.875rem' />
            </Stack>
            <Row gap='075'>
                <LoadingSkeleton width='6.5rem' height='2rem' borderRadius='999px' />
                <LoadingSkeleton width='7.5rem' height='2rem' borderRadius='999px' />
                <LoadingSkeleton width='5.5rem' height='2rem' borderRadius='999px' />
            </Row>
        </Row>

        <Box display='flex' flex='1' minH='0' className='latex-workspace__layout'>
            <Stack gap='1' minH='0' style={{
                    width: panelWidths.files,
                    padding: '1rem',
                    borderRight: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                }}>
                <LoadingSkeleton width='5.5rem' height='0.875rem' />
                {LOADING_FILE_PANEL_BLOCKS.map((block) => <div
                    key={block.key}
                    style={{
                        width: block.width,
                        height: '0.875rem',
                        borderRadius: '999px',
                        background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                    }}
                />)}
            </Stack>

            <Stack flex='1' minW='0' className='latex-workspace__main-content'>
                <Stack gap='1' flex='1' minH='0' style={{ padding: '1.5rem' }}>
                    <LoadingSkeleton width='11rem' height='1rem' />
                    <LoadingSkeleton width='100%' height='2.5rem' borderRadius='0.85rem' />
                    <LoadingSkeleton width='100%' height='100%' borderRadius='1rem' />
                    <Stack gap='075' width='max' style={{ maxWidth: '42rem' }}>
                        {LOADING_EDITOR_BLOCKS.map((block) => <div
                            key={block.key}
                            style={{
                                width: block.width,
                                height: '0.9rem',
                                borderRadius: '999px',
                                background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                            }}
                        />)}
                    </Stack>
                </Stack>

                {isAIPanelOpen && (
                    <Stack id='latex-ai-panel' gap='075' className='latex-ai-panel' style={{
                            height: panelWidths.ai,
                            padding: '1rem',
                            borderTop: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                        }}>
                        <LoadingSkeleton width='5rem' height='0.875rem' />
                        <div
                            style={{
                                width: '42%',
                                height: '0.875rem',
                                borderRadius: '999px',
                                background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                            }}
                        />
                        <div
                            style={{
                                width: '75%',
                                height: '0.875rem',
                                borderRadius: '999px',
                                background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                            }}
                        />
                    </Stack>
                )}
            </Stack>

            <Stack gap='1' minH='0' style={{
                    width: panelWidths.preview,
                    padding: '1rem',
                    borderLeft: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                }}>
                <LoadingSkeleton width='5.75rem' height='0.875rem' />
                {LOADING_PREVIEW_BLOCKS.map((block) => <div
                    key={block.key}
                    style={{
                        width: block.width,
                        height: block.key === 'preview-1' ? '9rem' : '1rem',
                        borderRadius: '0.75rem',
                        background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                    }}
                />)}
            </Stack>
        </Box>
    </Stack>
);

export default LatexWorkspaceSkeleton;
