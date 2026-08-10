import { Button, EmptyStateRoot, cn } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';

import {
    OPTIONS_EDITOR_CLASS,
    OPTIONS_ERROR_HINT_CLASS,
    OPTIONS_FOOTER_CLASS,
    OPTIONS_GRID_ACTION_SPACER_CLASS,
    OPTIONS_GRID_CLASS,
    OPTIONS_GRID_GAP_CLASS,
    OPTIONS_GRID_HEADER_CLASS,
    OPTIONS_INPUT_CLASS,
    OPTIONS_INPUT_ERROR_CLASS,
    OPTIONS_INPUT_LABEL_OFFSET_CLASS,
    OPTIONS_LIST_CLASS,
    OPTIONS_REMOVE_CLASS,
    OPTIONS_ROW_CLASS,
    OPTIONS_ROW_ERROR_CLASS
} from '@/modules/plugin/components/plugin/NodeEditor/editors/ArgumentsEditor/argument-editor-styles';

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
        <li className={cn(OPTIONS_ROW_CLASS, hasError ? OPTIONS_ROW_ERROR_CLASS : null)}>
            <input
                type='text'
                value={option.key}
                onChange={(event) => onOptionChange({ key: event.currentTarget.value })}
                placeholder={KEY_PLACEHOLDER}
                className={cn(OPTIONS_INPUT_CLASS, 'font-mono', hasError ? OPTIONS_INPUT_ERROR_CLASS : null)}
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
                className={cn(OPTIONS_INPUT_CLASS, OPTIONS_INPUT_LABEL_OFFSET_CLASS)}
                aria-label={`Option ${index + 1} label`}
                onKeyDown={handleLabelKeyDown}
            />

            {/*
              * HeroUI's `ButtonProps` is closed and declares no `title` (spec §5b note
              * 8); the `aria-label` already carries the same string, so only the native
              * tooltip goes.
              */}
            <Button
                isIconOnly
                variant='ghost'
                size='sm'
                className={OPTIONS_REMOVE_CLASS}
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
            <div className={OPTIONS_EDITOR_CLASS}>
                <EmptyStateRoot className='flex flex-col items-center justify-center gap-2 p-4 text-center'>
                    <h3 className='text-base font-medium text-foreground'>No options defined</h3>
                    <span className='text-sm leading-normal text-muted'>Add options to populate the select.</span>
                </EmptyStateRoot>
                <div className='flex flex-row items-center justify-center gap-2'>
                    {/* bravais `variant='solid' intent='brand'` — the accent fill — is `primary` (§4d). */}
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
        <div className={OPTIONS_EDITOR_CLASS}>
            <div className={OPTIONS_GRID_CLASS} aria-hidden='true'>
                <span className={OPTIONS_GRID_HEADER_CLASS}>Key</span>
                <span className={OPTIONS_GRID_GAP_CLASS} />
                <span className={OPTIONS_GRID_HEADER_CLASS}>Label</span>
                <span className={OPTIONS_GRID_ACTION_SPACER_CLASS} />
            </div>

            <ul className={OPTIONS_LIST_CLASS} role='list'>
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

            <div className={OPTIONS_FOOTER_CLASS}>
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
                    <span className={OPTIONS_ERROR_HINT_CLASS} role='status'>
                        Duplicate keys must be unique
                    </span>
                )}
            </div>
        </div>
    );
};

export default ArgumentOptionsEditor;
