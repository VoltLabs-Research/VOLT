import AsyncMenuItemWrapper from '@/shared/ui/components/AsyncMenuItemWrapper';
import { getColumnKey, getColumnTitle } from '@/shared/ui/components/DocumentListingTable';
import { Button, Heading, Popover, PopoverMenu, Row, SegmentedTabs, Skeleton, Stack, Text } from '@voltstack/bravais';
import { Check, Columns3, Plus } from 'lucide-react';
import { RxDotsHorizontal } from 'react-icons/rx';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { ListingViewPreferences } from '@/shared/ui/components/DocumentListing/use-listing-view-preferences';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ReactNode } from 'react';

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

const HeaderIconButton = ({ label, children }: { label: string; children: ReactNode }) => (
    <Button
        variant='ghost'
        intent='neutral'
        size='sm'
        shape='circle'
        iconOnly
        title={label}
        aria-label={label}
    >
        {children}
    </Button>
);

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
}: DocumentListingHeaderProps<TRow>) => (
    <Stack gap='3'>
        <Stack gap='1-5' p='2' className='document-listing-header-top-container'>
            <Row justify='between' align='start' gap='1-5' className='document-listing-header-row'>
                <Row gap='1' align='start' className='document-listing-header-main'>
                    {showTitleSkeleton ? (
                        <Stack gap='025'>
                            <Skeleton variant='text' width={220} height={32} />
                            {description ? <Skeleton variant='text' width={224} height={18} /> : null}
                        </Stack>
                    ) : (
                        <Stack gap='025' className='document-listing-header-title-block'>
                            {typeof title === 'string' ? (
                                <Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>{title}</Heading>
                            ) : (
                                title
                            )}
                            {description ? (
                                <Text as='p' size='sm' tone='muted' className='document-listing-header-description'>
                                    {description}
                                </Text>
                            ) : null}
                        </Stack>
                    )}
                    {(showColumnPicker || headerMenuOptions.length > 0) && (
                        <Row gap='05'>
                            {showColumnPicker && (
                                <Popover
                                    id='document-listing-column-picker'
                                    trigger={<HeaderIconButton label='Toggle columns'><Columns3 size={16} /></HeaderIconButton>}
                                    noPadding
                                    className='context-menu-popover context-menu-popover--md'
                                >
                                    {() => (
                                        <PopoverMenu label='Toggle columns'>
                                            {columns.map((col) => {
                                                const columnKey = getColumnKey(col);
                                                const isVisible = !preferences.hiddenColumnKeys.has(columnKey);
                                                return (
                                                    <button
                                                        type='button'
                                                        role='menuitemcheckbox'
                                                        aria-checked={isVisible}
                                                        key={`document-listing-column-option-${columnKey}`}
                                                        className='document-listing-column-picker-item d-flex items-center gap-075'
                                                        onClick={() => preferences.toggleColumnVisibility(columnKey)}
                                                    >
                                                        <span className='document-listing-column-picker-check d-flex flex-center' aria-hidden='true'>
                                                            {isVisible ? <Check size={14} /> : null}
                                                        </span>
                                                        <span className='flex-1 text-left'>{getColumnTitle(col)}</span>
                                                    </button>
                                                );
                                            })}
                                        </PopoverMenu>
                                    )}
                                </Popover>
                            )}
                            {headerMenuOptions.length > 0 && (
                                <Popover
                                    id='document-listing-header-menu'
                                    trigger={<HeaderIconButton label='Open listing actions'><RxDotsHorizontal /></HeaderIconButton>}
                                    noPadding
                                    className='context-menu-popover context-menu-popover--md'
                                >
                                    {(close) => (
                                        <PopoverMenu>
                                            {headerMenuOptions.map((option, index) => (
                                                <AsyncMenuItemWrapper
                                                    key={`document-listing-header-option-${option.label}-${index}`}
                                                    option={option}
                                                    size='md'
                                                    onSuccess={close}
                                                />
                                            ))}
                                        </PopoverMenu>
                                    )}
                                </Popover>
                            )}
                        </Row>
                    )}
                </Row>
                <Row gap='2' className='document-listing-header-actions'>
                    {headerActions}
                    {createNew && (
                        <Button variant='solid' intent='brand' onClick={createNew.onCreate} leftIcon={<Plus size={18} />}>
                            {createNew.buttonTitle}
                        </Button>
                    )}
                </Row>
            </Row>
        </Stack>

        {!hideTabs && tabs.length >= 2 && (
            <div>
                <div className='document-listing-header-tabs-container'>
                    <SegmentedTabs
                        tabs={tabs}
                        activeTab={preferences.activeTabId}
                        onChange={preferences.selectTab}
                        ariaLabel='Listing views'
                        layoutId={`${preferences.persistenceKey}-tabs`}
                    />
                </div>
                <div className='document-listing-header-filters-container' />
            </div>
        )}
    </Stack>
);

export default DocumentListingHeader;
