import {
    Autocomplete,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownSection,
    DropdownTrigger,
    Header,
    SearchField,
    useFilter
} from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import Scrollable from '@/shared/ui/components/Scrollable';
import { useCallback, useState } from 'react';
import type { Key } from 'react';
import type { PluginPickerSection } from '../../utils/plugin-picker-sections';

interface AddPluginMenuProps {
    sections: PluginPickerSection[];
    isDisabled?: boolean;
    onAdd: (id: string) => void;
}

const queryWords = (query: string) => query.trim().split(/\s+/).filter(Boolean);

// The part of a name the query matched, in a heavier weight, so the eye lands on it as the list narrows.
const MatchedLabel = ({ label, query }: { label: string; query: string }) => {
    const word = queryWords(query).sort((a, b) => b.length - a.length)[0];
    const index = word ? label.toLowerCase().indexOf(word.toLowerCase()) : -1;
    if (index < 0) return <>{label}</>;

    return (
        <>
            {label.slice(0, index)}
            <span className='font-semibold'>{label.slice(index, index + word.length)}</span>
            {label.slice(index + word.length)}
        </>
    );
};

const AddPluginMenu = ({ sections, isDisabled, onAdd }: AddPluginMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { contains } = useFilter({ sensitivity: 'base' });

    // Every word must appear in the name, in any order: "template matching" and "matching ptm" both find PTM.
    const filter = useCallback(
        (textValue: string, inputValue: string) => queryWords(inputValue).every((word) => contains(textValue, word)),
        [contains]
    );

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) setQuery('');
    };

    return (
        <DropdownRoot isOpen={isOpen} onOpenChange={handleOpenChange}>
            <DropdownTrigger
                isDisabled={isDisabled}
                aria-label='Add plugin'
                className='flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full border-none bg-foreground/[0.05] pl-3.5 pr-2.5 text-xs text-muted transition-colors duration-[140ms] hover:bg-foreground/[0.08] hover:text-foreground disabled:cursor-default disabled:opacity-50 aria-expanded:bg-foreground/[0.08] aria-expanded:text-foreground'
            >
                <span className='min-w-0 flex-1 truncate text-left'>Add plugin…</span>
                <ChevronDown size={13} aria-hidden='true' className='shrink-0' />
            </DropdownTrigger>
            <DropdownPopover
                placement='bottom start'
                className='flex w-(--trigger-width) min-w-0 max-w-[calc(100vw-1rem)] flex-col overflow-hidden md:min-w-0'
            >
                <Autocomplete.Filter filter={filter} inputValue={query} onInputChange={setQuery}>
                    <SearchField autoFocus aria-label='Search plugins' variant='secondary' fullWidth className='shrink-0 px-1.5 pt-1.5'>
                        {/* Focus shows as the caret and the darker tint, and the active row as the hover tint, as in a
                            command menu: a ring inside the menu reads as a second edge. */}
                        <SearchField.Group className='h-8 rounded-full border-0 bg-foreground/5 pe-1.5 hover:bg-foreground/8 focus-within:bg-foreground/8 focus-within:ring-0 focus-within:ring-offset-0'>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder='Search plugins' className='min-w-0 flex-1 text-sm' />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    <Scrollable className='max-h-[30rem] min-h-0 flex-1 overscroll-contain'>
                        <DropdownMenu
                            aria-label='Add plugin'
                            className='p-1.5 pt-1'
                            onAction={(key: Key) => onAdd(String(key))}
                            renderEmptyState={() => (
                                <p className='px-2 py-5 text-center text-sm text-muted'>No plugins match “{query.trim()}”</p>
                            )}
                        >
                            {sections.map((section) => (
                                <DropdownSection key={section.id} id={section.id}>
                                    <Header className='px-2.5 pb-0.5 pt-2 text-2xs'>{section.label}</Header>
                                    {section.entries.map((entry) => (
                                        <DropdownItem
                                            key={entry.id}
                                            id={entry.id}
                                            textValue={entry.label}
                                            className='min-h-8 px-2.5 py-1 text-sm data-[focused=true]:bg-default data-[focus-visible=true]:ring-0 data-[focus-visible=true]:ring-offset-0'
                                        >
                                            <span className='min-w-0 truncate'>
                                                <MatchedLabel label={entry.label} query={query} />
                                            </span>
                                        </DropdownItem>
                                    ))}
                                </DropdownSection>
                            ))}
                        </DropdownMenu>
                    </Scrollable>
                </Autocomplete.Filter>
            </DropdownPopover>
        </DropdownRoot>
    );
};

export default AddPluginMenu;
