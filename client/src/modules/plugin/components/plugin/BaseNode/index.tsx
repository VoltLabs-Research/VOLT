import { Chip, cn } from '@heroui/react';
import NodeDebugOutput from '@/modules/plugin/components/plugin/BaseNode/NodeDebugOutput';
import NodeExecutionLog from '@/modules/plugin/components/plugin/BaseNode/NodeExecutionLog';
import useNodeDebugView from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import {
    NODE_BADGE_CLASS,
    NODE_BTN_GROUP_CLASS,
    NODE_CLASS,
    NODE_DATA_BTN_ACTIVE_CLASS,
    NODE_DATA_BTN_CLASS,
    NODE_DESCRIPTION_CLASS,
    NODE_SELECTED_CLASS,
    NODE_WRAPPER_BADGE_CLASS,
    NODE_WRAPPER_CLASS
} from '@/modules/plugin/components/plugin/BaseNode/node-styles';
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

/**
 * bravais's `Tag` defaulted to `variant='soft'`, so each tone was a tinted fill with
 * the hue as the text colour — which is exactly HeroUI's `Chip variant='soft'`. Its
 * `neutral` becomes `default`; there is no `brand` tone in play here.
 */
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

/**
 * A plain `<button>`, deliberately.
 *
 * The handler calls `event.stopPropagation()` so opening the data or log overlay does
 * not also select the node underneath — and React Aria's `onPress` receives a
 * `PressEvent`, which has no `stopPropagation` (spec §4b). Nothing is lost by staying
 * native: `.workflow-node-data-btn` re-painted every part of bravais's Button anyway
 * (fill, border, padding, font size, colour), so those declarations are the whole
 * look and they are utilities now.
 */
const DebugActionButton = ({ icon, isActive, onClick, children }: DebugActionButtonProps) => (
    <button
        type='button'
        className={cn(NODE_DATA_BTN_CLASS, isActive ? NODE_DATA_BTN_ACTIVE_CLASS : null)}
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

    // `data` is `Record<string, unknown>` on xyflow's `NodeProps`.
    const nodeData = data as INodeData | undefined;
    // Handles only move when the layout changes, and xyflow needs to be told.
    const connectorLayoutSignature = JSON.stringify(nodeData?.connectorLayout ?? {});

    useEffect(() => {
        updateNodeInternals(id);
    }, [connectorLayoutSignature, id, updateNodeInternals]);

    return (
        <div className={cn(NODE_WRAPPER_CLASS, overheadBadge ? NODE_WRAPPER_BADGE_CLASS : null)}>
            {overheadBadge && (
                <Chip
                    size='sm'
                    variant='soft'
                    color={BADGE_COLOR[overheadBadge.tone]}
                    className={NODE_BADGE_CLASS}
                >
                    {overheadBadge.label}
                </Chip>
            )}

            <div className={cn(NODE_CLASS, selected ? NODE_SELECTED_CLASS : null, debugClass)}>
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
                            <p className={NODE_DESCRIPTION_CLASS}>
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {children}
            </div>

            {(hasInspectableOutput || hasLog) && (
                <div className={NODE_BTN_GROUP_CLASS}>
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
