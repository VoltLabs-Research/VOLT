import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import './ClusterMongoDocumentViewer.css';
import Box from '@/shared/presentation/primitives/Box';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import type { TeamClusterMongoDocument } from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterMongoDocumentViewerProps {
    documents: TeamClusterMongoDocument[];
}

const ClusterMongoDocumentViewer = ({ documents }: ClusterMongoDocumentViewerProps) => {
    if (documents.length === 0) {
        return (
            <Row justify='center' height='max' p='1' radius='md' className='cluster-mongo-document-card'>
                <Text as='p' size='md' tone='secondary'>No documents found for this collection.</Text>
            </Row>
        );
    }

    return (
        <Stack gap='1' overflow='y-auto' className='cluster-mongo-document-viewer'>
            {documents.map((document) => (
                <Stack key={document.id} gap='075' p='1' radius='md' className='cluster-mongo-document-card'>
                    <Heading level={3} size='md' weight='bold'>{document.id}</Heading>
                    <Box p='1' radius='md' overflow='auto' className='cluster-mongo-document-body'>
                        <JsonTree data={document.value} />
                    </Box>
                </Stack>
            ))}
        </Stack>
    );
};

export default ClusterMongoDocumentViewer;
