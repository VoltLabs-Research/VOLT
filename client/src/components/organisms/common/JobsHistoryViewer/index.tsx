import React, { useRef, memo } from 'react';
import JobsHistory from '@/components/molecules/common/JobsHistory';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
// Double-tap / resize / move removed for a simpler, minimal experience

const JobsHistoryViewer: React.FC = memo(() => {

    return(
        <Container className='jobs-history-viewer-enhanced expanded'>
            <Container className='jobs-history-expanded-content'>
                <Container
                    className='jobs-history-viewer-header-enhanced'
                    style={{ touchAction: 'none' }}
                >
                    <Container className='header-content'>
                        <Title className='font-size-3 font-weight-6 color-primary sm:font-size-2'>Recent Team Activity</Title>
                        <Paragraph className='font-size-2 color-secondary jobs-history-subtitle'>The listed processes are queued and executed given the cluster load.</Paragraph>
                    </Container>
                </Container>
                <Container className='jobs-history-viewer-body-enhanced'>
                    <JobsHistory />
                </Container>
            </Container>
        </Container>
    );
});

JobsHistoryViewer.displayName = 'JobsHistoryViewerMobile';

export default JobsHistoryViewer;
