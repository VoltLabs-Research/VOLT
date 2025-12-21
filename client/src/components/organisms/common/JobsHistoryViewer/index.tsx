import React, { memo } from 'react';
import JobsHistory from '@/components/molecules/common/JobsHistory';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    showHeader?: boolean;
}

const JobsHistoryViewer: React.FC<JobsHistoryViewerProps> = memo(({ trajectoryId, showHeader = true }) => {

    return (
        <Container className='jobs-history-viewer-enhanced expanded p-absolute overflow-hidden cursor-pointer'>
            <Container className='jobs-history-expanded-content'>
                {showHeader && (
                    <Container
                        className='jobs-history-viewer-header-enhanced f-shrink-0'
                        style={{ touchAction: 'none' }}
                    >
                        <Container className='header-content column gap-02 d-flex flex-1'>
                            <Title className='font-size-2-5 font-weight-6 color-primary'>
                                {trajectoryId ? 'Trajectory Jobs' : 'Recent Team Activity'}
                            </Title>
                            <Paragraph className='font-size-2 color-secondary jobs-history-subtitle overflow-hidden'>
                                {trajectoryId
                                    ? 'Analysis and processing jobs for this trajectory.'
                                    : 'The listed processes are queued and executed given the cluster load.'}
                            </Paragraph>
                        </Container>
                    </Container>
                )}
                <Container className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                    <JobsHistory trajectoryId={trajectoryId} />
                </Container>
            </Container>
        </Container>
    );
});

JobsHistoryViewer.displayName = 'JobsHistoryViewer';

export default JobsHistoryViewer;
