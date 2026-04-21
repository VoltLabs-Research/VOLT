import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import './ClusterMongoDocumentViewer.css';
import type { TeamClusterMongoDocument } from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterMongoDocumentViewerProps {
    documents: TeamClusterMongoDocument[];
};

const ClusterMongoDocumentViewer = ({ documents }: ClusterMongoDocumentViewerProps) => {
    if (documents.length === 0) {
        return (
            <div className='volt-container d-flex items-center content-center h-max p-1 radius-md cluster-mongo-document-card'>
                <p className='volt-text font-size-2 color-secondary'>No documents found for this collection.</p>
            </div>
        );
    }

    return (
        <div className='volt-container cluster-mongo-document-viewer d-flex column gap-1 y-auto'>
            {documents.map((document) => (
                <div key={document.id} className='volt-container cluster-mongo-document-card d-flex column gap-075 p-1 radius-md'>
                    <h3 className='volt-title font-size-2 font-weight-6 color-primary'>{document.id}</h3>
                    <div className='volt-container cluster-mongo-document-body p-1 radius-md overflow-auto'>
                        <JsonTree data={document.value} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ClusterMongoDocumentViewer;
