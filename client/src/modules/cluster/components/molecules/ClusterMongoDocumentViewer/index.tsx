import JsonTree from '@/modules/plugin/components/plugin/atoms/JsonTree';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import './ClusterMongoDocumentViewer.css';
import type { TeamClusterMongoDocument } from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterMongoDocumentViewerProps {
    documents: TeamClusterMongoDocument[];
};

const ClusterMongoDocumentViewer = ({ documents }: ClusterMongoDocumentViewerProps) => {
    if (documents.length === 0) {
        return (
            <Container className='d-flex items-center content-center h-max p-1 radius-md cluster-mongo-document-card'>
                <Paragraph className='font-size-2 color-secondary'>No documents found for this collection.</Paragraph>
            </Container>
        );
    }

    return (
        <Container className='cluster-mongo-document-viewer d-flex column gap-1 y-auto'>
            {documents.map((document) => (
                <Container key={document.id} className='cluster-mongo-document-card d-flex column gap-075 p-1 radius-md'>
                    <Title className='font-size-2 font-weight-6 color-primary'>{document.id}</Title>
                    <Container className='cluster-mongo-document-body p-1 radius-md overflow-auto'>
                        <JsonTree data={document.value} />
                    </Container>
                </Container>
            ))}
        </Container>
    );
};

export default ClusterMongoDocumentViewer;
