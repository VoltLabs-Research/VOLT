import { Box, Button, IconButton, EmptyState, Row, Stack, Text } from '@voltstack/bravais';
import { Plus, Trash2 } from 'lucide-react';

import type { IArgumentOption } from '@volt/contracts/modules/plugin/workflow';
import type { KeyboardEvent } from 'react';

import './ArgumentOptionsEditor.css';

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
        <li className={`argument-options-row flex items-center gap-2${hasError ? ' has-error' : ''}`}>
            <input
                type='text'
                value={option.key}
                onChange={(event) => onOptionChange({ key: event.currentTarget.value })}
                placeholder={KEY_PLACEHOLDER}
                className={`argument-options-input argument-options-input--key font-mono text-md flex-1${hasError ? ' has-error' : ''}`}
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
                className='argument-options-input argument-options-input--label text-md flex-1'
                aria-label={`Option ${index + 1} label`}
                onKeyDown={handleLabelKeyDown}
            />

            <IconButton
                type='button'
                variant='ghost'
                size='sm'
                className='argument-options-row__remove'
                aria-label={`Remove option ${index + 1}`}
                title='Remove option'
                onClick={onRemove}
            >
                <Trash2 size={12} aria-hidden='true' />
            </IconButton>
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
            <Stack gap='075' className='argument-options-editor'>
                <EmptyState
                    title='No options defined'
                    description='Add options to populate the select.'
                />
                <Row justify='center' gap='05'>
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        leftIcon={<Plus size={12} />}
                        onClick={handleAddOption}
                    >
                        Add first option
                    </Button>
                </Row>
            </Stack>
        );
    }

    return (
        <Stack gap='075' className='argument-options-editor'>
            <Row className='argument-options-grid' aria-hidden='true'>
                <Box as='span' flex='1' className='argument-options-grid__header text-eyebrow'>Key</Box>
                <span className='argument-options-grid__gap' />
                <Box as='span' flex='1' className='argument-options-grid__header text-eyebrow'>Label</Box>
                <span className='argument-options-grid__spacer--action' />
            </Row>

            <Stack as='ul' gap='025' role='list' className='argument-options-list'>
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
            </Stack>

            <Stack gap='05' className='argument-options-footer'>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    block
                    leftIcon={<Plus size={12} />}
                    onClick={handleAddOption}
                >
                    Add option
                </Button>
                {duplicateKeys.size > 0 && (
                    <Text as='span' size='xs' role='status' className='argument-options-error-hint'>
                        Duplicate keys must be unique
                    </Text>
                )}
            </Stack>
        </Stack>
    );
};

export default ArgumentOptionsEditor;
