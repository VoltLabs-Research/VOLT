import React from 'react';
import { formatDuration, formatDistanceToNow } from 'date-fns';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import { formatConfigValue } from '@/features/canvas/components/molecules/CanvasSidebarScene/utils';

interface AnalysisTooltipContentProps {
    analysis: any; // Using any for now to match strict type of original, ideally explicit type
}

const AnalysisTooltipContent: React.FC<AnalysisTooltipContentProps> = ({ analysis }) => {
    if (!analysis) return null;

    return (
        <Container className='analysis-tooltip-content'>
            <Container className='analysis-tooltip-header-container d-flex column gap-05'>
                <Title className='font-weight-4 font-size-3 d-flex gap-05'>
                    <span>{analysis.pluginDisplayName}</span>
                    {analysis.duration != null && (
                        <span className='color-muted'>
                            {' • '}
                            {formatDuration({ seconds: Math.floor(analysis.duration / 1000) })}
                        </span>
                    )}
                </Title>

                {analysis.plugin?.plugin?.modifier?.description && (
                    <Paragraph className='color-tertiary font-size-1'>
                        {analysis.plugin?.plugin?.modifier?.description}
                    </Paragraph>
                )}
            </Container>

            <Container className='analysis-tooltip-tables d-flex gap-2'>
                {analysis.config && Object.keys(analysis.config).length > 0 && (
                    <Container className='analysis-tooltip-grid'>
                        {Object.entries(analysis.config).map(([key, value]) => {
                            const argDef = analysis.plugin?.plugin?.arguments?.find((arg: any) => arg.argument === key);
                            const label = argDef?.label || key;

                            return (
                                <React.Fragment key={key}>
                                    <span className='color-muted font-size-1'>{label}</span>
                                    <span className='color-secondary font-size-1 font-weight-5'>
                                        {formatConfigValue(value)}
                                    </span>
                                </React.Fragment>
                            );
                        })}
                    </Container>
                )}

                <Container className='analysis-tooltip-grid'>
                    <span className='color-muted font-size-1'>Exposures</span>
                    <span className='color-secondary font-size-1 font-weight-5'>
                        {analysis.entry?.exposures?.length || 0}
                    </span>

                    <span className='color-muted font-size-1'>Completed Frames</span>
                    <span className='color-secondary font-size-1 font-weight-5'>
                        {analysis.analysis.completedFrames}
                    </span>

                    {analysis.analysis.clusterId && (
                        <>
                            <span className='color-muted font-size-1'>Cluster</span>
                            <span className='color-secondary font-size-1 font-weight-5'>
                                {analysis.analysis.clusterId}
                            </span>
                        </>
                    )}

                    <span className='color-muted font-size-1'>Created</span>
                    <span className='color-secondary font-size-1 font-weight-5'>
                        {formatDistanceToNow(new Date(analysis.analysis.createdAt), { addSuffix: true })}
                    </span>
                </Container>
            </Container>
        </Container>
    );
};

export default AnalysisTooltipContent;
