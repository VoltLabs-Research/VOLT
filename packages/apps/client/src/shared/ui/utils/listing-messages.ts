interface ListingItemTitleSource {
    title?: string | null;
    name?: string | null;
}

interface ListingDeleteConfirmationOptions<TItem> {
    singularName: string;
    pluralName: string;
    untitledLabel: string;
    getTitle?: (item: TItem) => string | null | undefined;
}

export const resolveListingItemTitle = <TItem>(
    item: TItem,
    untitledLabel: string,
    getTitle?: (item: TItem) => string | null | undefined
): string => {
    const source = item as ListingItemTitleSource;
    const title = getTitle ? getTitle(item) : source.title ?? source.name;

    return title?.trim() || untitledLabel;
};

export const createListingDeleteConfirmation = <TItem>({
    singularName,
    pluralName,
    untitledLabel,
    getTitle
}: ListingDeleteConfirmationOptions<TItem>) => (selectedItems: TItem[]): string => {
    if (selectedItems.length !== 1) {
        return `Delete ${selectedItems.length} ${pluralName}? This action cannot be undone.`;
    }

    return `Delete ${singularName} "${resolveListingItemTitle(selectedItems[0], untitledLabel, getTitle)}"? This action cannot be undone.`;
};
