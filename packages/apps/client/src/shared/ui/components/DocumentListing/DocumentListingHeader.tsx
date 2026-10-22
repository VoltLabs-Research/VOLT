import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { getColumnKey, getColumnTitle } from '@/shared/ui/components/DocumentListingTable';
import {
    Button,
    DropdownItem,
    DropdownItemIndicator,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownTrigger,
    cn
} from '@heroui/react';
import { Columns3, Ellipsis, Plus } from 'lucide-react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { ListingViewPreferences } from '@/shared/ui/components/DocumentListing/use-listing-view-preferences';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ReactNode } from 'react';
import type { Selection } from '@heroui/react';

export interface DocumentListingTab {
    id: string;
    label: string;
};

export interface DocumentListingCreateNew {
    buttonTitle: string;
    onCreate: () => void;
};

interface DocumentListingHeaderProps<TRow> {
    title: ReactNode;
    description?: ReactNode;
    columns: ColumnConfig<TRow>[];
    showColumnPicker: boolean;
    headerActions?: ReactNode;
    headerMenuOptions: MenuOption[];
    createNew?: DocumentListingCreateNew;
    tabs: DocumentListingTab[];
    hideTabs: boolean;
    preferences: ListingViewPreferences<TRow>;
};

// The 36px icon buttons beside the title.
const TITLE_ICON_BUTTON_CLASS = 'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/6 aria-expanded:text-foreground';

const DocumentListingHeader = <TRow,>({
    title,
    description,
    columns,
    showColumnPicker,
    headerActions,
    headerMenuOptions,
    createNew,
    tabs,
    hideTabs,
    preferences
}: DocumentListingHeaderProps<TRow>) => {
    const visibleColumnKeys = columns
        .map(getColumnKey)
        .filter((columnKey) => !preferences.hiddenColumnKeys.has(columnKey));

    const handleColumnSelectionChange = (selection: Selection) => {
        if(selection === 'all') return;

        const nextVisibleKeys = new Set([...selection].map(String));

        columns.forEach((col) => {
            const columnKey = getColumnKey(col);
            const wasVisible = !preferences.hiddenColumnKeys.has(columnKey);

            if(wasVisible !== nextVisibleKeys.has(columnKey)){
                preferences.toggleColumnVisibility(columnKey);
            }
        });
    };

    const hasActions = Boolean(headerActions || createNew);

    return (
        <div className='flex shrink-0 flex-col'>
            <div className='mb-6 flex flex-row flex-wrap items-start justify-between gap-4'>
                <div className='flex min-w-0 flex-col gap-1'>
                    <div className='flex min-w-0 flex-row items-center gap-1'>
                        {typeof title === 'string' ? (
                            <h1 className='min-w-0 truncate text-2xl font-semibold tracking-[-0.01em] text-foreground'>{title}</h1>
                        ) : (
                            title
                        )}
                        {showColumnPicker && (
                            <DropdownRoot>
                                <DropdownTrigger
                                    className={TITLE_ICON_BUTTON_CLASS}
                                    aria-label='Toggle columns'
                                >
                                    <Columns3 size={18} aria-hidden='true' />
                                </DropdownTrigger>
                                <DropdownPopover placement='bottom start'>
                                    <DropdownMenu
                                        aria-label='Toggle columns'
                                        selectionMode='multiple'
                                        selectedKeys={visibleColumnKeys}
                                        onSelectionChange={handleColumnSelectionChange}
                                    >
                                        {columns.map((col) => {
                                            const columnKey = getColumnKey(col);
                                            const columnTitle = getColumnTitle(col);

                                            return (
                                                <DropdownItem
                                                    key={`document-listing-column-option-${columnKey}`}
                                                    id={columnKey}
                                                    textValue={columnTitle}
                                                >
                                                    <DropdownItemIndicator type='checkmark' />
                                                    {columnTitle}
                                                </DropdownItem>
                                            );
                                        })}
                                    </DropdownMenu>
                                </DropdownPopover>
                            </DropdownRoot>
                        )}
                        {headerMenuOptions.length > 0 && (
                            <ContextMenuPopover
                                id='document-listing-header-menu'
                                triggerAction='click'
                                placement='bottom-start'
                                ariaLabel='Listing actions'
                                menuLabel='Listing actions'
                                options={headerMenuOptions}
                                trigger={(
                                    <button
                                        type='button'
                                        className={TITLE_ICON_BUTTON_CLASS}
                                        title='Open listing actions'
                                        aria-label='Open listing actions'
                                    >
                                        <Ellipsis size={18} aria-hidden='true' />
                                    </button>
                                )}
                            />
                        )}
                    </div>
                    {description ? (
                        <p className='max-w-lg text-sm text-muted text-pretty'>
                            {description}
                        </p>
                    ) : null}
                </div>
                {hasActions && (
                    <div className='flex flex-row flex-wrap items-center gap-2'>
                        {headerActions}
                        {createNew && (
                            <Button variant='primary' onPress={createNew.onCreate}>
                                <Plus size={18} aria-hidden='true' />
                                {createNew.buttonTitle}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {!hideTabs && tabs.length >= 2 && (
                <div
                    className='mb-4 inline-flex shrink-0 gap-0.5 self-start rounded-xl bg-foreground/5 p-0.5'
                    role='tablist'
                    aria-label='Listing views'
                >
                    {tabs.map((tab) => {
                        const isActive = preferences.activeTabId === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type='button'
                                role='tab'
                                aria-selected={isActive}
                                className={cn(
                                    'inline-flex h-7.5 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border-0 px-3.5 text-sm font-medium select-none transition-colors duration-200 ease-out',
                                    isActive ? 'bg-foreground/9 text-foreground' : 'bg-transparent text-muted hover:text-foreground'
                                )}
                                onClick={() => preferences.selectTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DocumentListingHeader;
