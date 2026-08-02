import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import { buildSubListingsPath } from '@/modules/plugin/utils/listing/build-sub-listings-path';
import { buildAtomsViewerPath } from '@/modules/trajectory/utils/build-atoms-viewer-path';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';

interface ListingRowSubListingTarget {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
}

interface ListingRowMenuOptionsParams {
    row: ListingRow;
    subListingNames: string[];
    navigate: (path: string) => void;
    /** Omitted when the row cannot be deleted. */
    onDelete?: () => void;
    /** Renders the sub-listing in place instead of navigating to its page. */
    onViewSubListing?: (target: ListingRowSubListingTarget) => void;
    /** Row-scoped navigation is hidden while several rows are selected. */
    allowRowNavigation?: boolean;
}

/**
 * Context menu of a single listing row: inspect its atoms, open one of its
 * sub-listings, or delete the analysis that produced it.
 */
export const buildListingRowMenuOptions = ({
    row,
    subListingNames,
    navigate,
    onDelete,
    onViewSubListing,
    allowRowNavigation = true
}: ListingRowMenuOptionsParams): MenuOption[] => {
    const { trajectoryId, analysisId, exposureId, timestep } = row;
    const options: MenuOption[] = [];

    if(allowRowNavigation && trajectoryId && analysisId && timestep !== undefined){
        options.push({
            label: 'Inspect Atoms',
            icon: RiEyeLine,
            onClick: () => navigate(buildAtomsViewerPath({
                trajectoryId,
                analysisId,
                timestep
            }))
        });

        for(const subListingName of subListingNames){
            options.push({
                label: `View ${formatSnakeCaseToTitle(subListingName)}`,
                icon: RiTableLine,
                onClick: () => {
                    if(!exposureId) return;
                    if(onViewSubListing){
                        onViewSubListing({
                            analysisId,
                            exposureId,
                            timestep,
                            subListingName
                        });
                        return;
                    }
                    navigate(buildSubListingsPath({
                        trajectoryId,
                        analysisId,
                        exposureId,
                        timestep,
                        subListingNames,
                        activeSubListingName: subListingName
                    }));
                }
            });
        }
    }

    if(analysisId && onDelete){
        options.push({
            label: 'Delete',
            icon: RiDeleteBin6Line,
            onClick: onDelete,
            destructive: true
        });
    }

    return options;
};
