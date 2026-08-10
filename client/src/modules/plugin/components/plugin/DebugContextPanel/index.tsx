import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { Braces, ChevronDown, ChevronRight, X, Repeat } from 'lucide-react';
import { useState } from 'react';
import './DebugContextPanel.css';

type DebugContextOutput = Record<string, unknown>;
type DebugContextEntry = [string, DebugContextOutput];

interface ChevronProps {
    expanded: boolean;
    size?: number;
}

const Chevron = ({ expanded, size = 11 }: ChevronProps) =>
    expanded ? <ChevronDown size={size} /> : <ChevronRight size={size} />;

/**
 * Groups context entries around the forEach node so the iteration body can be
 * rendered as a nested, collapsible group.
 */
const splitContextEntries = (
    entries: DebugContextEntry[],
    forEachNodeId: string | null,
    executionOrder: Array<{ nodeId: string }>
) => {
    const orderIds = executionOrder.map((item) => item.nodeId);
    const forEachPos = forEachNodeId ? orderIds.indexOf(forEachNodeId) : -1;

    const pre: DebugContextEntry[] = [];
    let feEntry: DebugContextEntry | null = null;
    const post: DebugContextEntry[] = [];

    if (!forEachNodeId || forEachPos === -1) {
        return {
            preForEach: entries,
            forEachEntry: feEntry,
            postForEach: post,
            currentIndex: 0
        };
    }

    const preIds = new Set(orderIds.slice(0, forEachPos));
    const postIds = new Set(orderIds.slice(forEachPos + 1));

    for (const [nodeId, output] of entries) {
        if (nodeId === forEachNodeId) feEntry = [nodeId, output];
        else if (preIds.has(nodeId)) pre.push([nodeId, output]);
        else if (postIds.has(nodeId)) post.push([nodeId, output]);
    }

    pre.sort((a, b) => orderIds.indexOf(a[0]) - orderIds.indexOf(b[0]));
    post.sort((a, b) => orderIds.indexOf(a[0]) - orderIds.indexOf(b[0]));

    return {
        preForEach: pre,
        forEachEntry: feEntry,
        postForEach: post,
        currentIndex: Number(feEntry?.[1].currentIndex ?? 0)
    };
};

const DebugContextPanel = () => {
    const contextSnapshot = usePluginDebugStore((s) => s.contextSnapshot);
    const isDebugging = usePluginDebugStore((s) => s.isDebugging || s.totalDuration !== null);
    const forEachNodeId = usePluginDebugStore((s) => s.forEachNodeId);
    const totalIterations = usePluginDebugStore((s) => s.totalIterations);
    const executionOrder = usePluginDebugStore((s) => s.executionOrder);
    const nodes = usePluginBuilderStore((s) => s.nodes);

    const [isOpen, setIsOpen] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const entries = Object.entries(contextSnapshot);
    const hasData = entries.length > 0;

    const toggleKey = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const { preForEach, forEachEntry, postForEach, currentIndex } = splitContextEntries(
        entries,
        forEachNodeId,
        executionOrder
    );

    if (!isDebugging || !hasData) return null;

    const getNodeLabel = (nodeId: string): string => {
        const nodeType = nodes.find((n) => n.id === nodeId)?.type;
        if (!nodeType) return nodeId;
        return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
    };

    const renderEntry = (nodeId: string, output: DebugContextOutput) => {
        const isExpanded = expandedKeys.has(nodeId);
        return (
            <div key={nodeId} className='debug-context-entry'>
                <div className='flex flex-row items-center justify-between gap-2 debug-context-row cursor-pointer' onClick={() => toggleKey(nodeId)}>
                    <div className='flex flex-col'>
                        <p className='debug-context-label'>{getNodeLabel(nodeId)}</p>
                        <p className='text-muted debug-context-id'>{nodeId}</p>
                    </div>
                    <Chevron expanded={isExpanded} />
                </div>
                {isExpanded && (
                    <div className='debug-context-tree'>
                        <JsonTree data={output} defaultExpanded={true} />
                    </div>
                )}
            </div>
        );
    };

    const iterationKey = `__iteration_${currentIndex}`;
    const forEachGroupKey = '__foreach_group';
    const iterationCount = Number(forEachEntry?.[1].count ?? totalIterations ?? 0);

    return (
        <div className='flex flex-col absolute z-10 debug-context-panel bg-surface border border-border panel-floating top-4 right-4'>
            <div className='flex flex-row items-center justify-between gap-2 debug-context-row debug-context-panel-header cursor-pointer select-none' onClick={() => setIsOpen((v) => !v)}>
                <Braces size={12} />
                <p className='flex flex-row items-center gap-[0.35rem] debug-context-panel-title f-1 text-xs font-semibold'>
                    Context
                    <span className='font-semibold debug-context-panel-count rounded-full'>{entries.length}</span>
                </p>
                {isOpen ? <X size={12} className='text-muted' /> : <ChevronRight size={12} />}
            </div>

            {isOpen && (
                <div className='flex-1 min-h-0 debug-context-panel-body nowheel overflow-y-auto'>
                    {preForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}

                    {forEachEntry && (
                        <div className='debug-context-entry'>
                            <div className='flex flex-row items-center justify-between gap-2 debug-context-row cursor-pointer' onClick={() => toggleKey(forEachGroupKey)}>
                                <div className='flex flex-row items-center gap-2'>
                                    <Repeat size={10} className='text-muted' />
                                    <div className='flex flex-col'>
                                        <p className='debug-context-label'>{getNodeLabel(forEachEntry[0])}</p>
                                        <p className='text-muted debug-context-id'>
                                            {iterationCount} iteration{iterationCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <Chevron expanded={expandedKeys.has(forEachGroupKey)} />
                            </div>

                            {expandedKeys.has(forEachGroupKey) && (
                                <div className='debug-context-nested'>
                                    <div className='debug-context-entry'>
                                        <div className='flex flex-row items-center justify-between gap-2 debug-context-row cursor-pointer' onClick={() => toggleKey(iterationKey)}>
                                            <p className='debug-context-label'>Iteration {currentIndex}</p>
                                            <Chevron expanded={expandedKeys.has(iterationKey)} size={10} />
                                        </div>

                                        {expandedKeys.has(iterationKey) && (
                                            <div className='debug-context-nested'>
                                                {postForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!forEachEntry && postForEach.length === 0 && entries.length > preForEach.length &&
                        entries.slice(preForEach.length).map(([nodeId, output]) => renderEntry(nodeId, output))
                    }
                </div>
            )}
        </div>
    );
};

export default DebugContextPanel;
