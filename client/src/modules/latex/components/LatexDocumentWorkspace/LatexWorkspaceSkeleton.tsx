import { Box, Row, Stack, Skeleton } from '@voltstack/bravais';
import type { PanelWidths } from './use-latex-panel-layout';

interface PlaceholderBlockProps {
    width: string;
    height?: string;
    borderRadius?: string;
}

interface LatexWorkspaceSkeletonProps {
    panelWidths: PanelWidths;
    isAIPanelOpen: boolean;
}

const BLOCK_BACKGROUND = 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))';
const PANEL_BORDER = '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))';

const FILE_PANEL_BLOCKS = ['72%', '88%', '64%', '81%'];
const EDITOR_BLOCKS = ['94%', '86%', '91%', '67%'];
const PREVIEW_BLOCKS: PlaceholderBlockProps[] = [
    {
        width: '100%',
        height: '9rem',
        borderRadius: '0.75rem'
    },
    {
        width: '100%',
        height: '1rem',
        borderRadius: '0.75rem'
    },
    {
        width: '82%',
        height: '1rem',
        borderRadius: '0.75rem'
    }
];

const PlaceholderBlock = ({
    width,
    height = '0.875rem',
    borderRadius = '999px'
}: PlaceholderBlockProps) => (
    <div
        style={{
            width,
            height,
            borderRadius,
            background: BLOCK_BACKGROUND
        }}
    />
);

const LoadingSkeleton = ({
    width,
    height,
    borderRadius = '999px'
}: PlaceholderBlockProps) => (
    <Skeleton
        variant='rectangular'
        animation='wave'
        width={width}
        height={height}
        style={{
            borderRadius,
            backgroundColor: BLOCK_BACKGROUND
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
                <LoadingSkeleton width='6.5rem' height='2rem' />
                <LoadingSkeleton width='7.5rem' height='2rem' />
                <LoadingSkeleton width='5.5rem' height='2rem' />
            </Row>
        </Row>

        <Box display='flex' flex='1' minH='0' className='latex-workspace__layout'>
            <Stack gap='1' minH='0' style={{
                    width: panelWidths.files,
                    padding: '1rem',
                    borderRight: PANEL_BORDER
                }}>
                <LoadingSkeleton width='5.5rem' height='0.875rem' />
                {FILE_PANEL_BLOCKS.map((width, index) => <PlaceholderBlock key={index} width={width} />)}
            </Stack>

            <Stack flex='1' minW='0' className='latex-workspace__main-content'>
                <Stack gap='1' flex='1' minH='0' style={{ padding: '1.5rem' }}>
                    <LoadingSkeleton width='11rem' height='1rem' />
                    <LoadingSkeleton width='100%' height='2.5rem' borderRadius='0.85rem' />
                    <LoadingSkeleton width='100%' height='100%' borderRadius='1rem' />
                    <Stack gap='075' width='max' style={{ maxWidth: '42rem' }}>
                        {EDITOR_BLOCKS.map((width, index) => <PlaceholderBlock key={index} width={width} height='0.9rem' />)}
                    </Stack>
                </Stack>

                {isAIPanelOpen && (
                    <Stack id='latex-ai-panel' gap='075' className='latex-ai-panel' style={{
                            height: panelWidths.ai,
                            padding: '1rem',
                            borderTop: PANEL_BORDER
                        }}>
                        <LoadingSkeleton width='5rem' height='0.875rem' />
                        <PlaceholderBlock width='42%' />
                        <PlaceholderBlock width='75%' />
                    </Stack>
                )}
            </Stack>

            <Stack gap='1' minH='0' style={{
                    width: panelWidths.preview,
                    padding: '1rem',
                    borderLeft: PANEL_BORDER
                }}>
                <LoadingSkeleton width='5.75rem' height='0.875rem' />
                {PREVIEW_BLOCKS.map((block, index) => <PlaceholderBlock key={index} {...block} />)}
            </Stack>
        </Box>
    </Stack>
);

export default LatexWorkspaceSkeleton;
