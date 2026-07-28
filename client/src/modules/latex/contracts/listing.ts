import type { LatexDocument, LatexFolder } from '@volt/contracts/modules/latex/domain';
import type { FolderedFolderRow, FolderedItemRow, FolderedListingRow } from '@/shared/ui/utils/foldered-listing-rows';

export interface LatexFolderRowExtras {
    createdBy: null;
    lastEditedBy: null;
}

export type LatexFolderRow = FolderedFolderRow<LatexFolder, LatexFolderRowExtras>;

export type LatexDocumentRow = FolderedItemRow<LatexDocument>;

export type LatexListingRow = FolderedListingRow<LatexFolder, LatexDocument, LatexFolderRowExtras>;
