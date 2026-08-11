import { useAnalysisListingExportOptionsQuery } from '@/modules/plugin/hooks/listing/queries';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal } from '@/shared/ui/modal/use-modal-store';
import { Switch } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface AnalysisListingDownloadSelection {
    analysisId: string;
    includeConfig: boolean;
    selectedListingIds: string[];
    selectedSubListingIds: string[];
}

interface AnalysisListingDownloadModalProps {
    analysisId?: string | null;
    isDownloading?: boolean;
    onDownload: (selection: AnalysisListingDownloadSelection) => Promise<boolean>;
    onClose: () => void;
}

export const ANALYSIS_LISTING_DOWNLOAD_MODAL_ID = 'canvas-analysis-listing-download-modal';

const formatOptionLabel = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        return value;
    }

    return trimmed
        .split(/[_-]+/g)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(' ');
};

const getSubListingSelectionName = (subListingName: string, fallbackLabel: string): string => {
    const trimmedSubListingName = subListingName.trim();

    if (trimmedSubListingName) {
        return trimmedSubListingName;
    }

    return fallbackLabel.trim();
};

const AnalysisListingDownloadModal = ({
    analysisId,
    isDownloading = false,
    onDownload,
    onClose
}: AnalysisListingDownloadModalProps) => {
    const optionsQuery = useAnalysisListingExportOptionsQuery(
        { analysisId: analysisId ?? '' },
        { enabled: Boolean(analysisId) }
    );
    const [includeConfig, setIncludeConfig] = useState(true);
    const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(new Set());
    const [selectedSubListingNames, setSelectedSubListingNames] = useState<Set<string>>(new Set());
    const [initializedAnalysisId, setInitializedAnalysisId] = useState<string | null>(null);

    const groupedSubListings = useMemo(() => {
        if (!optionsQuery.data) {
            return [];
        }

        const groups = new Map<string, { name: string; label: string; ids: string[] }>();

        optionsQuery.data.subListings.forEach((subListing) => {
            const name = getSubListingSelectionName(subListing.subListingName, subListing.label);
            const existingGroup = groups.get(name);

            if (existingGroup) {
                existingGroup.ids.push(subListing.id);
                return;
            }

            groups.set(name, {
                name,
                label: formatOptionLabel(name),
                ids: [subListing.id]
            });
        });

        return Array.from(groups.values());
    }, [optionsQuery.data]);

    useEffect(() => {
        if (!analysisId) {
            setIncludeConfig(true);
            setSelectedListingIds(new Set());
            setSelectedSubListingNames(new Set());
            setInitializedAnalysisId(null);
            return;
        }

        if (!analysisId || !optionsQuery.data || initializedAnalysisId === analysisId) {
            return;
        }

        setIncludeConfig(optionsQuery.data.hasConfig);
        setSelectedListingIds(new Set(optionsQuery.data.listings.map((listing) => listing.id)));
        setSelectedSubListingNames(new Set(groupedSubListings.map((subListing) => subListing.name)));
        setInitializedAnalysisId(analysisId);
    }, [analysisId, groupedSubListings, initializedAnalysisId, optionsQuery.data]);

    const toggleListing = (listingId: string, nextValue: boolean) => {
        setSelectedListingIds((current) => {
            const next = new Set(current);

            if (nextValue) {
                next.add(listingId);
            } else {
                next.delete(listingId);
            }

            return next;
        });
    };

    const toggleSubListing = (subListingName: string, nextValue: boolean) => {
        setSelectedSubListingNames((current) => {
            const next = new Set(current);

            if (nextValue) {
                next.add(subListingName);
            } else {
                next.delete(subListingName);
            }

            return next;
        });
    };

    const hasSelections = useMemo(() => {
        return includeConfig || selectedListingIds.size > 0 || selectedSubListingNames.size > 0;
    }, [includeConfig, selectedListingIds, selectedSubListingNames]);

    const handleClose = () => {
        closeModal(ANALYSIS_LISTING_DOWNLOAD_MODAL_ID);
    };

    const handleDownload = async () => {
        if (!analysisId || !hasSelections) {
            return;
        }

        const didDownload = await onDownload({
            analysisId,
            includeConfig,
            selectedListingIds: Array.from(selectedListingIds),
            selectedSubListingIds: groupedSubListings.flatMap((subListing) => {
                return selectedSubListingNames.has(subListing.name) ? subListing.ids : [];
            })
        });

        if (didDownload) {
            handleClose();
        }
    };

    const renderOptionRow = (
        rowKey: string,
        fieldKey: string,
        label: ReactNode,
        value: boolean,
        onChange: (nextValue: boolean) => void
    ) => (
        <div className='flex min-h-9 w-full min-w-0 flex-row items-center justify-between gap-4' key={rowKey}>
            <p className='min-w-0 flex-1 truncate text-xs text-foreground' id={`${fieldKey}-label`}>
                {label}
            </p>
            <div className='ml-3 flex-none'>
                <Switch
                    id={`${fieldKey}-toggle`}
                    isSelected={value}
                    onChange={onChange}
                    aria-labelledby={`${fieldKey}-label`}
                >
                    <Switch.Content>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch.Content>
                </Switch>
            </div>
        </div>
    );

    const isLoading = optionsQuery.isLoading && !optionsQuery.data;
    const hasError = !!optionsQuery.error;
    const optionsData = optionsQuery.data;
    const hasAvailableOptions = Boolean(
        optionsData?.hasConfig
        || (optionsData?.listings.length ?? 0) > 0
        || (optionsData?.subListings.length ?? 0) > 0
    );

    return (
        <Modal
            id={ANALYSIS_LISTING_DOWNLOAD_MODAL_ID}
            title='Download analysis results'
            description='Choose exactly which CSV files should be included in the download.'
            onClose={onClose}
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onPress: handleClose
                    }}
                    primary={{
                        label: 'Download',
                        isPending: isDownloading,
                        isDisabled: isLoading || hasError || !analysisId || !hasSelections,
                        onPress: handleDownload
                    }}
                />
            )}
        >
            <div className='flex w-full min-w-0 flex-col gap-4'>
                {isLoading && (
                    <p className='text-xs text-muted'>
                        Loading available listings and sublistings...
                    </p>
                )}

                {hasError && (
                    <p className='text-xs text-danger'>
                        Failed to load export options for this analysis.
                    </p>
                )}

                {!isLoading && !hasError && optionsData && (
                    <>
                        {!hasAvailableOptions ? (
                            <p className='py-2 text-xs text-muted'>
                                This analysis does not expose downloadable CSV files.
                            </p>
                        ) : (
                            <div className='flex max-h-64 w-full max-w-[450px] flex-col gap-2 overflow-auto pr-1'>
                                {optionsData.hasConfig && renderOptionRow(
                                    'analysis-download-config',
                                    'analysis-download-config',
                                    'Config.csv',
                                    includeConfig,
                                    setIncludeConfig
                                )}
                                {optionsData.listings.map((listing) => (
                                    renderOptionRow(
                                        listing.id,
                                        `analysis-download-listing-${listing.id}`,
                                        listing.label,
                                        selectedListingIds.has(listing.id),
                                        (next) => toggleListing(listing.id, next)
                                    )
                                ))}
                                {groupedSubListings.map((subListing) => (
                                    renderOptionRow(
                                        subListing.name,
                                        `analysis-download-sublisting-${subListing.name}`,
                                        subListing.label,
                                        selectedSubListingNames.has(subListing.name),
                                        (next) => toggleSubListing(subListing.name, next)
                                    )
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default AnalysisListingDownloadModal;
