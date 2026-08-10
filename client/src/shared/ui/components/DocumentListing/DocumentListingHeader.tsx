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
    Skeleton,
    Tab,
    TabIndicator,
    TabList,
    TabListContainer,
    TabsRoot
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
    showTitleSkeleton: boolean;
    columns: ColumnConfig<TRow>[];
    showColumnPicker: boolean;
    headerActions?: ReactNode;
    headerMenuOptions: MenuOption[];
    createNew?: DocumentListingCreateNew;
    tabs: DocumentListingTab[];
    hideTabs: boolean;
    preferences: ListingViewPreferences<TRow>;
};

/**
 * The circular ghost icon button bravais painted for `variant='ghost' intent='neutral'
 * size='sm' shape='circle'`. It stays a plain `<button>`/`DropdownTrigger` rather than
 * a HeroUI `Button` because both overlays clone press handlers onto their trigger:
 * `ContextMenuPopover` needs floating-ui's reference props to reach the DOM node, and
 * `DropdownTrigger` already *is* the React Aria button.
 */
const HEADER_ICON_BUTTON = 'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground';

/**
 * bravais's `variant='text'` skeleton painted at `scale(1, 0.6)` from `0 55%` while
 * reserving its full declared height. Kept so the header does not jump taller while a
 * listing loads.
 */
const TEXT_SKELETON = 'origin-[0_55%] scale-y-[0.6] rounded-md';

const DocumentListingHeader = <TRow,>({
    title,
    description,
    showTitleSkeleton,
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

    /**
     * React Aria hands back the whole next selection, while the preference store
     * toggles one column at a time, so the changed key is derived rather than
     * assumed — a press only ever flips one, and `'all'` cannot happen without
     * `allowsSelectAll`.
     */
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

    return (
        <div className='flex flex-col gap-12'>
            <div className='flex flex-col gap-6 p-8 max-md:gap-3 max-md:px-4 max-md:pt-5 max-md:pb-0'>
                <div className='flex flex-row items-start justify-between gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3'>
                    <div className='flex flex-row items-center gap-4 min-w-0 max-md:justify-between max-md:gap-2'>
                        {showTitleSkeleton ? (
                            <div className='flex flex-col gap-1'>
                                <Skeleton className={`h-8 w-[220px] ${TEXT_SKELETON}`} aria-hidden='true' />
                                {description ? <Skeleton className={`h-[18px] w-[224px] ${TEXT_SKELETON}`} aria-hidden='true' /> : null}
                            </div>
                        ) : (
                            <div className='flex flex-col gap-1 min-w-0'>
                                {typeof title === 'string' ? (
                                    <h3 className='text-3xl font-medium text-foreground'>{title}</h3>
                                ) : (
                                    title
                                )}
                                {description ? (
                                    <p className='text-xs text-muted max-w-[28rem]'>
                                        {description}
                                    </p>
                                ) : null}
                            </div>
                        )}
                        {(showColumnPicker || headerMenuOptions.length > 0) && (
                            <div className='flex flex-row items-center gap-2'>
                                {showColumnPicker && (
                                    <DropdownRoot>
                                        <DropdownTrigger
                                            className={HEADER_ICON_BUTTON}
                                            aria-label='Toggle columns'
                                        >
                                            {/* React Aria's Button drops `title`, so the native tooltip hangs off the glyph. */}
                                            <span className='flex items-center justify-center' title='Toggle columns'>
                                                <Columns3 size={16} aria-hidden='true' />
                                            </span>
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
                                                className={HEADER_ICON_BUTTON}
                                                title='Open listing actions'
                                                aria-label='Open listing actions'
                                            >
                                                <Ellipsis aria-hidden='true' />
                                            </button>
                                        )}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    <div className='flex flex-row items-center gap-8 max-md:w-full max-md:flex-wrap max-md:gap-2 max-md:[&>*]:flex-initial'>
                        {headerActions}
                        {createNew && (
                            <Button variant='primary' onPress={createNew.onCreate}>
                                <Plus size={18} aria-hidden='true' />
                                {createNew.buttonTitle}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {!hideTabs && tabs.length >= 2 && (
                <div>
                    <div className='px-8 max-md:px-4'>
                        <TabsRoot
                            selectedKey={preferences.activeTabId}
                            onSelectionChange={(tabId) => preferences.selectTab(String(tabId))}
                        >
                            <TabListContainer>
                                <TabList aria-label='Listing views'>
                                    {tabs.map((tab) => (
                                        <Tab key={tab.id} id={tab.id}>
                                            {tab.label}
                                            <TabIndicator />
                                        </Tab>
                                    ))}
                                </TabList>
                            </TabListContainer>
                        </TabsRoot>
                    </div>
                    <div />
                </div>
            )}
        </div>
    );
};

export default DocumentListingHeader;
