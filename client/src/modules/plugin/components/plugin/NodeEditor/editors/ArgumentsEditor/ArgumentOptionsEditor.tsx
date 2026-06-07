import { Box, Button, IconButton, EmptyState, Row, Stack, Text } from '@voltstack/bravais';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import type { IArgumentOption } from '@/modules/plugin/api/entities/plugin/workflow';
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
    totalCount: number;
    duplicateKey: boolean;
    missingKey: boolean;
    onKeyChange: (key: string) => void;
    onLabelChange: (label: string) => void;
    onRemove: () => void;
    onEnterOnLast: () => void;
}

const OptionRow = ({
    option,
    index,
    totalCount,
    duplicateKey,
    missingKey,
    onKeyChange,
    onLabelChange,
    onRemove,
    onEnterOnLast
}: OptionRowProps) => {
    const handleLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && index === totalCount - 1) {
            event.preventDefault();
            onEnterOnLast();
        }
    };

    const hasError = duplicateKey || missingKey;
    const errorTitle = missingKey
        ? 'Key is required'
        : duplicateKey
            ? 'Key must be unique'
            : undefined;

    return (
        <li className={`argument-options-row d-flex items-center gap-05${hasError ? ' has-error' : ''}`}>
            <input
                type='text'
                value={option.key}
                onChange={(event) => onKeyChange(event.currentTarget.value)}
                placeholder={KEY_PLACEHOLDER}
                className={`argument-options-input argument-options-input--key font-mono font-size-2 flex-1${hasError ? ' has-error' : ''}`}
                aria-label={`Option ${index + 1} key`}
                aria-invalid={hasError}
                title={errorTitle}
                spellCheck={false}
            />

            <input
                type='text'
                value={option.label}
                onChange={(event) => onLabelChange(event.currentTarget.value)}
                placeholder={LABEL_PLACEHOLDER}
                className='argument-options-input argument-options-input--label font-size-2 flex-1'
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

const ArgumentOptionsEditor = ({
    options,
    onOptionsChange
}: ArgumentOptionsEditorProps) => {
    const duplicateKeys = useMemo(() => {
        const seen = new Map<string, number>();
        const duplicates = new Set<string>();
        for (const option of options) {
            const trimmedKey = option.key.trim();
            if (!trimmedKey) continue;
            const prior = seen.get(trimmedKey) ?? 0;
            seen.set(trimmedKey, prior + 1);
            if (prior >= 1) duplicates.add(trimmedKey);
        }
        return duplicates;
    }, [options]);

    const handleKeyChange = useCallback((index: number, rawKey: string) => {
        const nextOptions = options.map((option, optionIndex) => {
            if (optionIndex !== index) return option;
            return { ...option, key: rawKey };
        });
        onOptionsChange(nextOptions);
    }, [options, onOptionsChange]);

    const handleLabelChange = useCallback((index: number, rawLabel: string) => {
        const nextOptions = options.map((option, optionIndex) => {
            if (optionIndex !== index) return option;
            return { ...option, label: rawLabel };
        });
        onOptionsChange(nextOptions);
    }, [options, onOptionsChange]);

    const handleAddOption = useCallback(() => {
        onOptionsChange([...options, { key: '', label: '' }]);
    }, [options, onOptionsChange]);

    const handleRemoveOption = useCallback((index: number) => {
        onOptionsChange(options.filter((_, optionIndex) => optionIndex !== index));
    }, [options, onOptionsChange]);

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
                            totalCount={options.length}
                            duplicateKey={trimmedKey.length > 0 && duplicateKeys.has(trimmedKey)}
                            missingKey={trimmedKey.length === 0}
                            onKeyChange={(key) => handleKeyChange(index, key)}
                            onLabelChange={(label) => handleLabelChange(index, label)}
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
