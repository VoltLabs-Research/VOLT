import { Button } from '@/shared/presentation/primitives';
import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import { CollapsibleSection } from '@/shared/presentation/primitives';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import type { INodeData, NodeConnectorSide } from '@/modules/plugin/api/entities/plugin/workflow';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    CONNECTOR_SIDE_OPTIONS,
    createNodeHandlePlacement,
    getNodeHandleDefinitions,
    readNodeConnectorLayout,
    resolveNodeHandlePlacement
} from '@/modules/plugin/utilities/plugin/node-handles';

interface ConnectorLayoutEditorProps {
    node: Node<INodeData>;
}

const ConnectorLayoutEditor = ({ node }: ConnectorLayoutEditorProps) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const currentNode = useMemo(() => {
        return storeNodes.find((candidate) => candidate.id === node.id) ?? node;
    }, [storeNodes, node]);

    const nodeType = currentNode.type as NodeType;
    const nodeData = currentNode.data;
    const handleDefinitions = useMemo(() => getNodeHandleDefinitions(nodeType), [nodeType]);
    const connectorLayout = useMemo(() => readNodeConnectorLayout(nodeData), [nodeData]);

    const updateHandlePlacement = useCallback((
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
    }, [connectorLayout, handleDefinitions, node.id, nodeData, updateNodeData]);

    const resetHandlePlacement = useCallback((handleId: string) => {
        if (!(handleId in connectorLayout)) {
            return;
        }

        const nextLayout = { ...connectorLayout };
        delete nextLayout[handleId];

        updateNodeData(node.id, {
            connectorLayout: nextLayout
        });
    }, [connectorLayout, node.id, updateNodeData]);

    if (handleDefinitions.length === 0) {
        return null;
    }

    return (
        <CollapsibleSection title='Connectors' defaultExpanded={false}>
            {handleDefinitions.map((handleDefinition, index) => {
                const placement = resolveNodeHandlePlacement(nodeData, handleDefinition);

                return (
                    <div key={handleDefinition.id} className='b-soft radius-sm' style={{
                            padding: '0.75rem',
                            marginTop: index === 0 ? 0 : '0.75rem'
                        }}>
                        <div className='d-flex items-center content-between gap-05' style={{ marginBottom: '0.75rem' }}>
                            <strong>{handleDefinition.label}</strong>
                            <Button
                                variant='outline'
                                intent='neutral'
                                size='sm'
                                onClick={() => resetHandlePlacement(handleDefinition.id)}
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
