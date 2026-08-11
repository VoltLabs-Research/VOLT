import { Button, EmptyStateRoot, cn } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';

import type { IArgumentOption } from '@volt/contracts/modules/plugin/workflow';
import type { KeyboardEvent } from 'react';

interface ArgumentOptionsEditorProps {
    options: IArgumentOption[];
    onOptionsChange: (nextOptions: IArgumentOption[]) => void;
}

const KEY_PLACEHOLDER = 'key';
const LABEL_PLACEHOLDER = 'Human-readable label';

interface OptionRowProps {
    option: IArgumentOption;
    index: number;
    isLast: boolean;
    errorTitle?: string;
    onOptionChange: (patch: Partial<IArgumentOption>) => void;
    onRemove: () => void;
    onEnterOnLast: () => void;
}

const OptionRow = ({
    option,
    index,
    isLast,
    errorTitle,
    onOptionChange,
    onRemove,
    onEnterOnLast
}: OptionRowProps) => {
    const handleLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && isLast) {
            event.preventDefault();
            onEnterOnLast();
        }
    };

    const hasError = Boolean(errorTitle);

    return (
        <li className={cn('group flex flex-row items-center gap-0 rounded-md border border-transparent px-1.5 py-1 transition-[background-color,border-color] duration-[120ms] ease-out hover:bg-surface-hover', hasError ? 'border-danger bg-danger/6' : null)}>
            <input
                type='text'
                value={option.key}
                onChange={(event) => onOptionChange({ key: event.currentTarget.value })}
                placeholder={KEY_PLACEHOLDER}
                className={cn('min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-foreground outline-none transition-[border-color,background-color] duration-[120ms] ease-out focus:border-accent focus:bg-background font-mono', hasError ? 'border-danger' : null)}
                aria-label={`Option ${index + 1} key`}
                aria-invalid={hasError}
                title={errorTitle}
                spellCheck={false}
            />
            <input
                type='text'
                value={option.label}
                onChange={(event) => onOptionChange({ label: event.currentTarget.value })}
                placeholder={LABEL_PLACEHOLDER}
                className='min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-foreground outline-none transition-[border-color,background-color] duration-[120ms] ease-out focus:border-accent focus:bg-background ml-4'
                aria-label={`Option ${index + 1} label`}
                onKeyDown={handleLabelKeyDown}
            />
            <Button
                isIconOnly
                variant='ghost'
                size='sm'
                className='ml-2 shrink-0 text-muted opacity-0 transition-[opacity,color] duration-[140ms] ease-out hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100'
                aria-label={`Remove option ${index + 1}`}
                onPress={onRemove}
            >
                <Trash2 size={12} aria-hidden='true' />
            </Button>
        </li>
    );
};

const getDuplicateKeys = (options: IArgumentOption[]): Set<string> => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const option of options) {
        const trimmedKey = option.key.trim();
        if (!trimmedKey) continue;
        if (seen.has(trimmedKey)) duplicates.add(trimmedKey);
        seen.add(trimmedKey);
    }

    return duplicates;
};

const ArgumentOptionsEditor = ({
    options,
    onOptionsChange
}: ArgumentOptionsEditorProps) => {
    const duplicateKeys = getDuplicateKeys(options);

    const handleOptionChange = (index: number, patch: Partial<IArgumentOption>) => {
        onOptionsChange(options.map((option, optionIndex) => {
            if (optionIndex !== index) return option;
            return {
                ...option,
                ...patch
            };
        }));
    };

    const handleAddOption = () => {
        onOptionsChange([...options, {
            key: '',
            label: ''
        }]);
    };

    const handleRemoveOption = (index: number) => {
        onOptionsChange(options.filter((_, optionIndex) => optionIndex !== index));
    };

    if (options.length === 0) {
        return (
            <div className='flex flex-col gap-3'>
                <EmptyStateRoot className='flex flex-col items-center justify-center gap-2 p-4 text-center'>
                    <h3 className='text-base font-medium text-foreground'>No options defined</h3>
                    <span className='text-sm leading-normal text-muted'>Add options to populate the select.</span>
                </EmptyStateRoot>
                <div className='flex flex-row items-center justify-center gap-2'>
                    <Button
                        variant='primary'
                        size='sm'
                        onPress={handleAddOption}
                    >
                        <Plus size={12} aria-hidden='true' />
                        Add first option
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex flex-row items-center gap-0 px-1' aria-hidden='true'>
                <span className='min-w-0 flex-1 pl-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Key</span>
                <span className='inline-block w-4 shrink-0' />
                <span className='min-w-0 flex-1 pl-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Label</span>
                <span className='inline-block w-7 shrink-0' />
            </div>
            <ul className='m-0 flex list-none flex-col gap-1 p-0' role='list'>
                {options.map((option, index) => {
                    const trimmedKey = option.key.trim();

                    return (
                        <OptionRow
                            key={`option-${index}`}
                            option={option}
                            index={index}
                            isLast={index === options.length - 1}
                            errorTitle={!trimmedKey
                                ? 'Key is required'
                                : duplicateKeys.has(trimmedKey)
                                    ? 'Key must be unique'
                                    : undefined}
                            onOptionChange={(patch) => handleOptionChange(index, patch)}
                            onRemove={() => handleRemoveOption(index)}
                            onEnterOnLast={handleAddOption}
                        />
                    );
                })}
            </ul>
            <div className='flex flex-col gap-2 pt-1'>
                <Button
                    variant='outline'
                    size='sm'
                    fullWidth
                    onPress={handleAddOption}
                >
                    <Plus size={12} aria-hidden='true' />
                    Add option
                </Button>
                {duplicateKeys.size > 0 && (
                    <span className='text-xs text-danger' role='status'>
                        Duplicate keys must be unique
                    </span>
                )}
            </div>
        </div>
    );
};

export default ArgumentOptionsEditor;
