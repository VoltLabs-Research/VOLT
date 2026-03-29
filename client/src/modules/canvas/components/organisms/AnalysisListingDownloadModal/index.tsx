import { useAnalysisListingExportOptionsQuery } from '@/modules/plugin/hooks/listing/queries';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Container from '@/shared/presentation/components/Container';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './AnalysisListingDownloadModal.css';
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
    pluginId?: string | null;
    isDownloading?: boolean;
    onDownload: (selection: AnalysisListingDownloadSelection) => Promise<boolean>;
    onClose: () => void;
}

export const ANALYSIS_LISTING_DOWNLOAD_MODAL_ID = 'canvas-analysis-listing-download-modal';
const ANALYSIS_LISTING_DOWNLOAD_PREFERENCES_STORAGE_KEY = 'volt:analysis-listing-download-preferences:v1';

interface AnalysisListingDownloadPreferences {
    includeConfig: boolean;
    selectedListingKeys: string[];
    selectedSubListingKeys: string[];
    updatedAt: number;
}

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

const getAnalysisListingDownloadPreferencesStorageKey = (pluginId: string): string => {
    return `${ANALYSIS_LISTING_DOWNLOAD_PREFERENCES_STORAGE_KEY}:${pluginId}`;
};

const readAnalysisListingDownloadPreferences = (pluginId: string): AnalysisListingDownloadPreferences | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const serializedPreferences = window.localStorage.getItem(
            getAnalysisListingDownloadPreferencesStorageKey(pluginId)
        );

        if (!serializedPreferences) {
            return null;
        }

        const parsedPreferences = JSON.parse(serializedPreferences) as Partial<AnalysisListingDownloadPreferences>;

        if (
            typeof parsedPreferences !== 'object'
            || parsedPreferences === null
            || !Array.isArray(parsedPreferences.selectedListingKeys)
            || !Array.isArray(parsedPreferences.selectedSubListingKeys)
            || typeof parsedPreferences.includeConfig !== 'boolean'
        ) {
            return null;
        }

        return {
            includeConfig: parsedPreferences.includeConfig,
            selectedListingKeys: parsedPreferences.selectedListingKeys.map(String),
            selectedSubListingKeys: parsedPreferences.selectedSubListingKeys.map(String),
            updatedAt: typeof parsedPreferences.updatedAt === 'number' ? parsedPreferences.updatedAt : Date.now()
        };
    } catch {
        return null;
    }
};

const writeAnalysisListingDownloadPreferences = (
    pluginId: string,
    preferences: AnalysisListingDownloadPreferences
): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            getAnalysisListingDownloadPreferencesStorageKey(pluginId),
            JSON.stringify(preferences)
        );
    } catch {
        return;
    }
};

const AnalysisListingDownloadModal = ({
    analysisId,
    pluginId,
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
    const [initializedSelectionScope, setInitializedSelectionScope] = useState<string | null>(null);

    const selectionScope = useMemo(() => {
        if (!analysisId) {
            return null;
        }

        return pluginId ? `${analysisId}:${pluginId}` : analysisId;
    }, [analysisId, pluginId]);

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

    const listingPreferenceEntries = useMemo(() => {
        return (optionsQuery.data?.listings ?? []).map((listing) => ({
            id: listing.id,
            key: listing.listingId
        }));
    }, [optionsQuery.data?.listings]);

    useEffect(() => {
        if (!analysisId) {
            setIncludeConfig(true);
            setSelectedListingIds(new Set());
            setSelectedSubListingNames(new Set());
            setInitializedSelectionScope(null);
            return;
        }

        if (!selectionScope || !optionsQuery.data || initializedSelectionScope === selectionScope) {
            return;
        }

        const savedPreferences = pluginId
            ? readAnalysisListingDownloadPreferences(pluginId)
            : null;

        if (!savedPreferences) {
            setIncludeConfig(optionsQuery.data.hasConfig);
            setSelectedListingIds(new Set(optionsQuery.data.listings.map((listing) => listing.id)));
            setSelectedSubListingNames(new Set(groupedSubListings.map((subListing) => subListing.name)));
            setInitializedSelectionScope(selectionScope);
            return;
        }

        setIncludeConfig(Boolean(optionsQuery.data.hasConfig && savedPreferences.includeConfig));
        setSelectedListingIds(new Set(
            listingPreferenceEntries
                .filter((listing) => savedPreferences.selectedListingKeys.includes(listing.key))
                .map((listing) => listing.id)
        ));
        setSelectedSubListingNames(new Set(
            groupedSubListings
                .filter((subListing) => savedPreferences.selectedSubListingKeys.includes(subListing.name))
                .map((subListing) => subListing.name)
        ));
        setInitializedSelectionScope(selectionScope);
    }, [analysisId, groupedSubListings, initializedSelectionScope, listingPreferenceEntries, optionsQuery.data, pluginId, selectionScope]);

    useEffect(() => {
        if (!pluginId || !analysisId || !optionsQuery.data || initializedSelectionScope !== selectionScope) {
            return;
        }

        writeAnalysisListingDownloadPreferences(pluginId, {
            includeConfig: Boolean(optionsQuery.data.hasConfig && includeConfig),
            selectedListingKeys: listingPreferenceEntries
                .filter((listing) => selectedListingIds.has(listing.id))
                .map((listing) => listing.key),
            selectedSubListingKeys: groupedSubListings
                .filter((subListing) => selectedSubListingNames.has(subListing.name))
                .map((subListing) => subListing.name),
            updatedAt: Date.now()
        });
    }, [analysisId, groupedSubListings, includeConfig, initializedSelectionScope, listingPreferenceEntries, optionsQuery.data, pluginId, selectedListingIds, selectedSubListingNames, selectionScope]);

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
        <Container key={rowKey} className='analysis-listing-download-modal__option-row d-flex content-between items-center gap-1'>
            <Paragraph
                id={`${fieldKey}-label`}
                className='analysis-listing-download-modal__option-label font-size-1 color-primary'
            >
                {label}
            </Paragraph>
            <Container className='analysis-listing-download-modal__option-toggle'>
                <LiquidToggle
                    id={`${fieldKey}-toggle`}
                    pressed={value}
                    onChange={onChange}
                    aria-labelledby={`${fieldKey}-label`}
                />
            </Container>
        </Container>
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
                        onClick: handleClose
                    }}
                    primary={{
                        label: 'Download',
                        isLoading: isDownloading,
                        disabled: isLoading || hasError || !analysisId || !hasSelections,
                        onClick: handleDownload
                    }}
                />
            )}
        >
            <Container className='analysis-listing-download-modal d-flex column gap-1 p-1-5'>
                {isLoading && (
                    <Paragraph className='font-size-1 color-secondary'>
                        Loading available listings and sublistings...
                    </Paragraph>
                )}

                {hasError && (
                    <Paragraph className='font-size-1 color-danger'>
                        Failed to load export options for this analysis.
                    </Paragraph>
                )}

                {!isLoading && !hasError && optionsData && (
                    <>
                        {!hasAvailableOptions ? (
                            <Paragraph className='analysis-listing-download-modal__empty font-size-1 color-muted'>
                                This analysis does not expose downloadable CSV files.
                            </Paragraph>
                        ) : (
                            <Container className='analysis-listing-download-modal__options d-flex column gap-05'>
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
                            </Container>
                        )}
                    </>
                )}
            </Container>
        </Modal>
    );
};

export default AnalysisListingDownloadModal;
