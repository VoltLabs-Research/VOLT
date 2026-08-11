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
import { Database, Terminal } from 'lucide-react';
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
    icon: ReactNode;
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}

const DebugActionButton = ({ icon, isActive, onClick, children }: DebugActionButtonProps) => (
    <button
        type='button'
        className={cn('inline-flex cursor-pointer flex-row items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface-secondary/80 px-2 py-[0.15rem] font-[inherit] text-[0.6rem] text-muted transition-[color,border-color,background-color] duration-150 hover:border-border-secondary hover:text-inherit', isActive ? 'border-accent bg-accent/8 text-accent' : null)}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onClick();
        }}
    >
        {icon}
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
        <div className={cn('relative inline-flex flex-col items-center', overheadBadge ? 'pt-5' : null)}>
            {overheadBadge && (
                <Chip
                    size='sm'
                    variant='soft'
                    color={BADGE_COLOR[overheadBadge.tone]}
                    className='absolute top-0 left-1/2 -translate-x-1/2 z-[1] pointer-events-none whitespace-nowrap rounded-full px-[0.4rem] py-[0.05rem] text-[0.6rem] font-semibold'
                >
                    {overheadBadge.label}
                </Chip>
            )}

            <div className={cn('relative max-w-[300px] rounded-lg border border-border bg-surface px-6 py-4 transition-[border-color,opacity,box-shadow] duration-200 ease-out', selected ? 'border-accent' : null, debugClass)}>
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

                <div className='flex flex-row items-center gap-4'>
                    <div className='flex flex-1 flex-col gap-[0.2rem]'>
                        <h3 className='text-base font-medium text-foreground'>{nodeTitle ?? config.label}</h3>
                        {description && (
                            <p className='line-clamp-2 overflow-hidden text-[0.8rem] text-muted'>
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {children}
            </div>

            {(hasInspectableOutput || hasLog) && (
                <div className='absolute top-full left-1/2 z-[2] mt-[0.35rem] -translate-x-1/2 inline-flex flex-row items-center gap-[0.3rem]'>
                    {hasInspectableOutput && (
                        <DebugActionButton
                            icon={<Database size={11} aria-hidden='true' />}
                            isActive={isInspectingOutput}
                            onClick={toggleInspectedOutput}
                        >
                            Data
                        </DebugActionButton>
                    )}

                    {hasLog && (
                        <DebugActionButton
                            icon={<Terminal size={11} aria-hidden='true' />}
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
