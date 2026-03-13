import DocumentListingTable from '@/shared/presentation/components/DocumentListingTable';
import { usePluginSubListingData } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing-data';
import Modal from '@/shared/presentation/components/Modal';
import { SUB_LISTING_MODAL_ID } from '@/modules/plugin/hooks/listing/use-plugin-listing';
import { useRef } from 'react';

import type { PluginSubListingParams } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';

interface SubListingModalProps {
    subListingParams: PluginSubListingParams | null;
    onClose?: () => void;
};

const SubListingModal: React.FC<SubListingModalProps> = ({ subListingParams, onClose }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const {
        title,
        columns,
        rows,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        errorMessage,
        handleLoadMore
    } = usePluginSubListingData(subListingParams);

    return (
        <Modal
            id={SUB_LISTING_MODAL_ID}
            title={title}
            width='min(1100px, 92vw)'
            onClose={onClose}
        >
            <div ref={scrollContainerRef} style={{ height: '60vh', overflow: 'auto' }}>
                <DocumentListingTable
                    columns={columns}
                    data={rows}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingNextPage}
                    hasMore={hasNextPage}
                    onLoadMore={handleLoadMore}
                    scrollContainerRef={scrollContainerRef}
                    errorMessage={errorMessage}
                    compact
                />
            </div>
        </Modal>
    );
};

export default SubListingModal;
