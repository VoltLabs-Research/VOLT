import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { Braces, ChevronDown, ChevronRight, X, Repeat } from 'lucide-react';
import { cn } from '@heroui/react';
import { useState } from 'react';

/**
 * `DebugContextPanel.css`, as utilities. `panel-floating` is dropped — it is a bravais
 * utility class whose stylesheet is gone and which nothing in the app ever defined;
 * the surface it implied is spelled out here as `border border-border bg-surface`.
 * `--accent-blue` is `--accent` (spec §3a), which is what tints the count pill.
 */
const PANEL_CLASS = 'absolute top-4 right-4 z-10 flex w-[280px] max-h-[320px] max-w-[calc(100vw-1rem)] flex-col border border-border bg-surface max-[768px]:w-[calc(100vw-1rem)] max-[768px]:max-h-[55dvh]';
const PANEL_HEADER_CLASS = 'border-b border-border px-2.5 py-2';
const PANEL_COUNT_CLASS = 'rounded-full bg-accent/15 px-[0.3rem] text-[0.6rem] font-semibold leading-[1.4] text-accent';
const ROW_CLASS = 'flex flex-row items-center justify-between gap-2 cursor-pointer px-2.5 py-[0.35rem] transition-colors duration-100 hover:bg-surface-tertiary/50';
const ENTRY_CLASS = 'border-b border-border/50 last:border-b-0';
const LABEL_CLASS = 'text-[0.65rem] font-semibold text-muted';
const ID_CLASS = 'max-w-[200px] overflow-hidden whitespace-nowrap text-ellipsis font-mono text-[0.55rem] text-muted';
const TREE_CLASS = 'px-2.5 pb-[0.375rem] font-mono text-[0.65rem] leading-normal';
const NESTED_CLASS = 'ml-2.5 border-l border-border';

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
            <div key={nodeId} className={ENTRY_CLASS}>
                <div className={ROW_CLASS} onClick={() => toggleKey(nodeId)}>
                    <div className='flex flex-col'>
                        <p className={LABEL_CLASS}>{getNodeLabel(nodeId)}</p>
                        <p className={ID_CLASS}>{nodeId}</p>
                    </div>
                    <Chevron expanded={isExpanded} />
                </div>
                {isExpanded && (
                    <div className={TREE_CLASS}>
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
        <div className={PANEL_CLASS}>
            <div className={cn(ROW_CLASS, PANEL_HEADER_CLASS, 'select-none')} onClick={() => setIsOpen((v) => !v)}>
                <Braces size={12} aria-hidden='true' />
                <p className='flex flex-1 flex-row items-center gap-[0.35rem] text-xs font-semibold'>
                    Context
                    <span className={PANEL_COUNT_CLASS}>{entries.length}</span>
                </p>
                {isOpen ? <X size={12} className='text-muted' aria-hidden='true' /> : <ChevronRight size={12} aria-hidden='true' />}
            </div>

            {isOpen && (
                <div className='nowheel min-h-0 flex-1 overflow-y-auto'>
                    {preForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}

                    {forEachEntry && (
                        <div className={ENTRY_CLASS}>
                            <div className={ROW_CLASS} onClick={() => toggleKey(forEachGroupKey)}>
                                <div className='flex flex-row items-center gap-2'>
                                    <Repeat size={10} className='text-muted' aria-hidden='true' />
                                    <div className='flex flex-col'>
                                        <p className={LABEL_CLASS}>{getNodeLabel(forEachEntry[0])}</p>
                                        <p className={ID_CLASS}>
                                            {iterationCount} iteration{iterationCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <Chevron expanded={expandedKeys.has(forEachGroupKey)} />
                            </div>

                            {expandedKeys.has(forEachGroupKey) && (
                                <div className={NESTED_CLASS}>
                                    <div className={ENTRY_CLASS}>
                                        <div className={ROW_CLASS} onClick={() => toggleKey(iterationKey)}>
                                            <p className={LABEL_CLASS}>Iteration {currentIndex}</p>
                                            <Chevron expanded={expandedKeys.has(iterationKey)} size={10} />
                                        </div>

                                        {expandedKeys.has(iterationKey) && (
                                            <div className={NESTED_CLASS}>
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
