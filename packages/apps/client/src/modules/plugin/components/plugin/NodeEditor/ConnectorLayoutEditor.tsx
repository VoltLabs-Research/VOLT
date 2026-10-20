import { Button, cn } from '@heroui/react';
import CollapsibleSection from '@/modules/plugin/components/plugin/CollapsibleSection';
import type { ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import type { INodeData, NodeConnectorSide } from '@volt/contracts/modules/plugin/workflow';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import {
    CONNECTOR_SIDE_OPTIONS,
    createNodeHandlePlacement,
    getNodeHandleDefinitions,
    resolveNodeHandlePlacement
} from '@/modules/plugin/utils/plugin/node-handles';

interface ConnectorLayoutEditorProps {
    node: Node<INodeData>;
}

const ConnectorLayoutEditor = ({ node }: ConnectorLayoutEditorProps) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const currentNode = storeNodes.find((candidate) => candidate.id === node.id) ?? node;
    const nodeData = currentNode.data;
    const handleDefinitions = getNodeHandleDefinitions(currentNode.type as NodeType);
    const connectorLayout = nodeData?.connectorLayout ?? {};

    const updateHandlePlacement = (
        handleId: string,
        nextPlacement: { side?: NodeConnectorSide; offset?: number; }
    ) => {
        const handleDefinition = handleDefinitions.find((candidate) => candidate.id === handleId);
        if (!handleDefinition) {
            return;
        }

        const currentPlacement = resolveNodeHandlePlacement(nodeData, handleDefinition);
        const resolvedPlacement = createNodeHandlePlacement(
            {
                ...currentPlacement,
                ...nextPlacement
            },
            handleDefinition
        );

        if (
            currentPlacement.side === resolvedPlacement.side
            && currentPlacement.offset === resolvedPlacement.offset
        ) {
            return;
        }

        updateNodeData(node.id, {
            connectorLayout: {
                ...connectorLayout,
                [handleId]: resolvedPlacement
            }
        });
    };

    const resetHandlePlacement = (handleId: string) => {
        if (!(handleId in connectorLayout)) {
            return;
        }

        const nextLayout = { ...connectorLayout };
        delete nextLayout[handleId];

        updateNodeData(node.id, {
            connectorLayout: nextLayout
        });
    };

    if (handleDefinitions.length === 0) {
        return null;
    }

    return (
        <CollapsibleSection title='Connectors' defaultExpanded={false}>
            {handleDefinitions.map((handleDefinition, index) => {
                const placement = resolveNodeHandlePlacement(nodeData, handleDefinition);

                return (
                    <div
                        className={cn('rounded-lg border border-border p-3', index === 0 ? 'mt-0' : 'mt-3')}
                        key={handleDefinition.id}
                    >
                        <div className='mb-3 flex flex-row items-center justify-between gap-2'>
                            <strong>{handleDefinition.label}</strong>
                            <Button
                                variant='outline'
                                size='sm'
                                onPress={() => resetHandlePlacement(handleDefinition.id)}
                            >
                                Reset
                            </Button>
                        </div>
                        <FormFieldRHF
                            variant='inline'
                            label='Side'
                            name={`${handleDefinition.id}-side`}
                            fieldType='select'
                            value={placement.side}
                            onChange={(event) => {
                                updateHandlePlacement(handleDefinition.id, {
                                    side: event.target.value as NodeConnectorSide
                                });
                            }}
                            options={CONNECTOR_SIDE_OPTIONS}
                        />
                        <FormFieldRHF
                            variant='inline'
                            label='Offset (%)'
                            name={`${handleDefinition.id}-offset`}
                            fieldType='input'
                            type='number'
                            value={placement.offset}
                            inputProps={{
                                min: 0,
                                max: 100,
                                step: 1
                            }}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                const nextOffset = Number(event.target.value);
                                updateHandlePlacement(handleDefinition.id, {
                                    offset: Number.isFinite(nextOffset)
                                        ? nextOffset
                                        : placement.offset
                                });
                            }}
                        />
                    </div>
                );
            })}
        </CollapsibleSection>
    );
};

export default ConnectorLayoutEditor;
