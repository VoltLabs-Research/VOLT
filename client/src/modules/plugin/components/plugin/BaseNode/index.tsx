import DynamicIcon from '@/shared/ui/components/DynamicIcon';
import NodeDebugOutput from '@/modules/plugin/components/plugin/BaseNode/NodeDebugOutput';
import NodeExecutionLog from '@/modules/plugin/components/plugin/BaseNode/NodeExecutionLog';
import useNodeDebugView from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import { Box, Button, Heading, Row, Stack, Tag, Text } from '@voltstack/bravais';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import {
    createReactFlowHandleStyle,
    getNodeHandleDefinitions,
    resolveNodeHandlePlacement,
    toReactFlowHandlePosition
} from '@/modules/plugin/utils/plugin/node-handles';
import { Database, Terminal } from 'lucide-react';
import { Handle, useUpdateNodeInternals } from '@xyflow/react';
import { useEffect } from 'react';
import type { INodeData } from '@volt/contracts/modules/plugin/workflow';
import type { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: string;
    description?: string;
    children?: ReactNode;
}

interface DebugActionButtonProps {
    icon: ReactNode;
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}

const DebugActionButton = ({ icon, isActive, onClick, children }: DebugActionButtonProps) => (
    <Button
        variant='ghost'
        size='sm'
        shape='pill'
        leftIcon={icon}
        className={`b-soft workflow-node-data-btn ${isActive ? 'workflow-node-data-btn--active' : ''}`}
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
    >
        {children}
    </Button>
);

const BaseNode = ({
    id,
    data,
    selected,
    nodeType,
    nodeTitle,
    description,
    children
}: BaseNodeProps) => {
    const config = NODE_CONFIGS[nodeType];
    const updateNodeInternals = useUpdateNodeInternals();
    const {
        debugState,
        logSegments,
        overheadBadge,
        debugClass,
        isInspectingOutput,
        hasInspectableOutput,
        hasLog,
        isShowingLog,
        expandedTraceIds,
        toggleInspectedOutput,
        toggleExecutionLog,
        toggleTraceNode
    } = useNodeDebugView(id, nodeType);

    // `data` is `Record<string, unknown>` on xyflow's `NodeProps`.
    const nodeData = data as INodeData | undefined;
    // Handles only move when the layout changes, and xyflow needs to be told.
    const connectorLayoutSignature = JSON.stringify(nodeData?.connectorLayout ?? {});

    useEffect(() => {
        updateNodeInternals(id);
    }, [connectorLayoutSignature, id, updateNodeInternals]);

    return (
        <Box position='relative' className={`workflow-node-wrapper ${overheadBadge ? 'workflow-node-wrapper--has-badge' : ''}`}>
            {overheadBadge && (
                <Tag
                    size='xs'
                    tone={overheadBadge.tone}
                    className='p-absolute top-0 center-x font-weight-6 workflow-node-overhead-badge'
                >
                    {overheadBadge.label}
                </Tag>
            )}

            <Box position='relative' border='soft' radius='sm' className={`workflow-node glass-bg ${selected ? 'workflow-node--selected' : ''} ${debugClass}`}>
                {getNodeHandleDefinitions(nodeType).map((handleDefinition) => {
                    const placement = resolveNodeHandlePlacement(nodeData, handleDefinition);

                    return (
                        <Handle
                            key={handleDefinition.id}
                            type={handleDefinition.type}
                            position={toReactFlowHandlePosition(placement.side)}
                            id={handleDefinition.id}
                            className={handleDefinition.className}
                            style={createReactFlowHandleStyle(placement)}
                        />
                    );
                })}

                <Row gap='1'>
                    <span className='d-flex items-center content-center workflow-node-icon'>
                        <DynamicIcon iconName={config.icon} />
                    </span>
                    <Stack gap='02' className='f-1'>
                        <Heading level={3}>{nodeTitle ?? config.label}</Heading>
                        {description && (
                            <Text as='p' tone='muted' className='overflow-hidden workflow-node-description'>
                                {description}
                            </Text>
                        )}
                    </Stack>
                </Row>

                {children}
            </Box>

            {(hasInspectableOutput || hasLog) && (
                <Box position='absolute' className='center-x items-center workflow-node-btn-group'>
                    {hasInspectableOutput && (
                        <DebugActionButton
                            icon={<Database size={11} />}
                            isActive={isInspectingOutput}
                            onClick={toggleInspectedOutput}
                        >
                            Data
                        </DebugActionButton>
                    )}

                    {hasLog && (
                        <DebugActionButton
                            icon={<Terminal size={11} />}
                            isActive={isShowingLog}
                            onClick={toggleExecutionLog}
                        >
                            Execution Log
                        </DebugActionButton>
                    )}
                </Box>
            )}

            {isInspectingOutput && debugState && (
                <NodeDebugOutput
                    debugState={debugState}
                    expandedTraceIds={expandedTraceIds}
                    onToggleTraceNode={toggleTraceNode}
                />
            )}

            {isShowingLog && (
                <NodeExecutionLog logSegments={logSegments} output={debugState?.output} />
            )}
        </Box>
    );
};

export default BaseNode;
