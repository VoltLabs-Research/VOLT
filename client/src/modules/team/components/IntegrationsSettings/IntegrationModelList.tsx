import { Button } from '@heroui/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { X } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TeamAIModelMetadata } from '@volt/contracts/modules/team/domain';

interface IntegrationModelListProps {
    models: TeamAIModelMetadata[];
    defaultModel: string | null;
    onAddModel: (model: TeamAIModelMetadata) => void;
    onRemoveModel: (modelId: string) => void;
}

/**
 * `.integrations-add-model-row` and the three rules that reached out of it.
 *
 * `> :nth-child(1)` / `:nth-child(2) { flex: 1 }` and
 * `.integrations-add-model-row .form-field-container { min-width: 0 }` both style
 * children this component does not render — `FormFieldRHF`'s own container. Their
 * intent (the two fields share the row and may shrink; the trailing Add button does
 * not) is re-expressed as ancestor-flag variants so the declarations land in
 * Tailwind's utilities layer instead of an unlayered stylesheet that would outrank
 * `FormFieldRHF`'s base classes. See migration spec §5b.3.
 */
const ADD_MODEL_ROW_CLASS = 'flex flex-row items-end gap-2 [&>*:nth-child(-n+2)]:flex-1 [&>*:nth-child(-n+2)]:min-w-0';

/** `.integrations-model-checklist` — `border-radius: 0.5rem` is 8px, HeroUI's `rounded-lg`. */
const MODEL_CHECKLIST_CLASS = 'max-h-[200px] overflow-y-auto border border-border rounded-lg';

/** `.integrations-model-item`, its `:last-child` border reset and its hover fill. */
const MODEL_ITEM_CLASS = 'flex flex-row items-center justify-between gap-2 px-2.5 py-2 min-h-12 select-none border-b border-border last:border-b-0 transition-colors duration-[120ms] hover:bg-surface-hover';

/**
 * Editor for the models enabled on an integration. The in-progress "add model" inputs are
 * local state, so remounting this component (via `key`) clears them.
 */
const IntegrationModelList = ({
    models,
    defaultModel,
    onAddModel,
    onRemoveModel
}: IntegrationModelListProps) => {
    const [newModelId, setNewModelId] = useState('');
    const [newModelName, setNewModelName] = useState('');

    const handleAddModel = () => {
        const id = newModelId.trim();
        if (!id || models.some((model) => model.id === id)) return;

        onAddModel({
            id,
            name: newModelName.trim() || id
        });
        setNewModelId('');
        setNewModelName('');
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddModel();
        }
    };

    return (
        <div className='flex flex-col gap-2'>
            <p className='text-sm font-medium text-muted'>
                Models
            </p>
            <div className={ADD_MODEL_ROW_CLASS}>
                <FormFieldRHF
                    label='Model ID'
                    placeholder='Model ID (e.g. gpt-4o)'
                    value={newModelId}
                    onChange={(event) => setNewModelId(event.target.value)}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />
                <FormFieldRHF
                    label='Display name'
                    placeholder='Display name'
                    value={newModelName}
                    onChange={(event) => setNewModelName(event.target.value)}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />
                <Button
                    size='sm'
                    variant='outline'
                    onPress={handleAddModel}
                    isDisabled={!newModelId.trim()}
                >
                    Add
                </Button>
            </div>
            {models.length > 0 && (
                <div className={MODEL_CHECKLIST_CLASS}>
                    {models.map((model) => {
                        const modelSummary = defaultModel === model.id ? `${model.id} · default` : model.id;

                        return (
                            <div className={MODEL_ITEM_CLASS} key={model.id}>
                                <div className='flex flex-col min-w-0'>
                                    <p className='text-sm text-foreground truncate' title={model.name}>
                                        {model.name}
                                    </p>
                                    <p className='text-xs text-muted truncate' title={modelSummary}>
                                        {modelSummary}
                                    </p>
                                </div>
                                <Button
                                    isIconOnly
                                    size='sm'
                                    variant='ghost'
                                    onPress={() => onRemoveModel(model.id)}
                                    aria-label={`Remove ${model.name}`}
                                >
                                    {/* React Aria's Button drops `title`, so the native tooltip hangs off the glyph. */}
                                    <span className='flex items-center justify-center' title={`Remove ${model.name}`}>
                                        <X size={14} aria-hidden='true' />
                                    </span>
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default IntegrationModelList;
