import { Chip, cn } from '@heroui/react';
import NodeDebugOutput from '@/modules/plugin/components/plugin/BaseNode/NodeDebugOutput';
import NodeExecutionLog from '@/modules/plugin/components/plugin/BaseNode/NodeExecutionLog';
import useNodeDebugView from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import {
    createReactFlowHandleStyle,
    getNodeHandleDefinitions,
    resolveNodeHandlePlacement,
    toReactFlowHandlePosition
} from '@/modules/plugin/utils/plugin/node-handles';
import { Handle, useUpdateNodeInternals } from '@xyflow/react';
import { useEffect } from 'react';
import type { ChipProps } from '@heroui/react';
import type { INodeData } from '@volt/contracts/modules/plugin/workflow';
import type { NodeOverheadBadgeTone } from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import type { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { NodeProps } from '@xyflow/react';
import type { MouseEvent, ReactNode } from 'react';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: string;
    description?: string;
    children?: ReactNode;
}

const BADGE_COLOR: Record<NodeOverheadBadgeTone, ChipProps['color']> = {
    success: 'success',
    danger: 'danger',
    neutral: 'default'
};

interface DebugActionButtonProps {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}

const DebugActionButton = ({ isActive, onClick, children }: DebugActionButtonProps) => (
    <button
        type='button'
        aria-pressed={isActive}
        className={cn('h-5.5 cursor-pointer whitespace-nowrap rounded-full bg-overlay px-2 text-2xs text-muted ring-1 ring-border transition-[color,box-shadow] duration-150 hover:text-foreground', isActive ? 'text-foreground ring-foreground' : null)}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onClick();
        }}
    >
        {children}
    </button>
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

    const nodeData = data as INodeData | undefined;

    const connectorLayoutSignature = JSON.stringify(nodeData?.connectorLayout ?? {});

    useEffect(() => {
        updateNodeInternals(id);
    }, [connectorLayoutSignature, id, updateNodeInternals]);

    return (
        <div className='relative inline-flex flex-col items-center'>
            {overheadBadge && (
                <Chip
                    size='sm'
                    variant='soft'
                    color={BADGE_COLOR[overheadBadge.tone]}
                    className='pointer-events-none absolute bottom-full left-1/2 z-[1] mb-1.5 -translate-x-1/2 whitespace-nowrap px-2 text-2xs font-semibold tabular-nums'
                >
                    {overheadBadge.label}
                </Chip>
            )}

            {/* Painted over the canvas so the grid stays out of the card. */}
            <div
                className={cn(
                    'relative max-w-[300px] rounded-2xl bg-canvas bg-linear-to-b from-surface to-surface px-5 py-4 shadow-xs ring-1 ring-border transition-[box-shadow,opacity] duration-150 ease-out',
                    selected ? 'shadow-[var(--overlay-shadow)] ring-[1.5px] ring-foreground' : null,
                    !selected && !debugClass ? 'hover:ring-foreground/30' : null,
                    debugClass
                )}
            >
                {getNodeHandleDefinitions(nodeType).map((handleDefinition) => {
                    const placement = resolveNodeHandlePlacement(nodeData, handleDefinition);

                    return (
                        <Handle
                            key={handleDefinition.id}
                            type={handleDefinition.type}
                            position={toReactFlowHandlePosition(placement.side)}
                            id={handleDefinition.id}
                            style={createReactFlowHandleStyle(placement)}
                        />
                    );
                })}

                <div className='flex min-w-0 flex-col gap-1'>
                    <h3 className='truncate text-base font-medium text-foreground'>{nodeTitle ?? config.label}</h3>
                    {description && (
                        <p className='line-clamp-2 text-sm text-muted'>
                            {description}
                        </p>
                    )}
                </div>

                {children}
            </div>

            {(hasInspectableOutput || hasLog) && (
                <div className='absolute top-full left-1/2 z-[2] mt-1.5 -translate-x-1/2 inline-flex flex-row items-center gap-1'>
                    {hasInspectableOutput && (
                        <DebugActionButton
                            isActive={isInspectingOutput}
                            onClick={toggleInspectedOutput}
                        >
                            Data
                        </DebugActionButton>
                    )}

                    {hasLog && (
                        <DebugActionButton
                            isActive={isShowingLog}
                            onClick={toggleExecutionLog}
                        >
                            Execution Log
                        </DebugActionButton>
                    )}
                </div>
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
        </div>
    );
};

export default BaseNode;
