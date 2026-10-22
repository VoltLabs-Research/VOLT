import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { ChevronRight } from 'lucide-react';
import { cn } from '@heroui/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

type DebugContextOutput = Record<string, unknown>;
type DebugContextEntry = [string, DebugContextOutput];

const ROW_CLASS_NAME = 'flex w-full cursor-pointer flex-row items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-foreground/4';

const Chevron = ({ expanded }: { expanded: boolean }) => (
    <ChevronRight size={12} aria-hidden='true' className={cn('shrink-0 text-muted transition-transform duration-200 ease-[var(--ease-emphasized)]', expanded && 'rotate-90')} />
);

interface ContextRowProps {
    title: string;
    subtitle?: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}

const ContextRow = ({ title, subtitle, expanded, onToggle, children }: ContextRowProps) => (
    <div className='border-t border-separator first:border-t-0'>
        <button type='button' className={ROW_CLASS_NAME} aria-expanded={expanded} onClick={onToggle}>
            <span className='flex min-w-0 flex-col'>
                <span className='text-2xs font-semibold text-muted'>{title}</span>
                {subtitle && (
                    <span className='max-w-[200px] truncate font-mono text-2xs text-muted'>{subtitle}</span>
                )}
            </span>
            <Chevron expanded={expanded} />
        </button>
        {expanded && children}
    </div>
);

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

    const renderEntry = (nodeId: string, output: DebugContextOutput) => (
        <ContextRow
            key={nodeId}
            title={getNodeLabel(nodeId)}
            subtitle={nodeId}
            expanded={expandedKeys.has(nodeId)}
            onToggle={() => toggleKey(nodeId)}
        >
            <div className='px-3.5 pb-2.5 font-mono text-2xs leading-relaxed'>
                <JsonTree data={output} defaultExpanded={true} />
            </div>
        </ContextRow>
    );

    const iterationKey = `__iteration_${currentIndex}`;
    const forEachGroupKey = '__foreach_group';
    const iterationCount = Number(forEachEntry?.[1].count ?? totalIterations ?? 0);

    return (
        <section aria-label='Debug context' className='glass-surface absolute top-4 right-4 z-10 flex w-[280px] max-h-[320px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl bg-overlay shadow-[var(--overlay-shadow)] max-[768px]:top-auto max-[768px]:right-2 max-[768px]:bottom-18 max-[768px]:left-18 max-[768px]:w-auto max-[768px]:max-h-[45dvh]'>
            <button
                type='button'
                className='flex w-full shrink-0 cursor-pointer select-none flex-row items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold'
                aria-expanded={isOpen}
                onClick={() => setIsOpen((v) => !v)}
            >
                Context
                <span className='rounded-full bg-foreground/8 px-1.5 text-2xs leading-4.5'>{entries.length}</span>
                <span className='ml-auto'>
                    <Chevron expanded={isOpen} />
                </span>
            </button>

            {isOpen && (
                <Scrollable className='nowheel min-h-0 flex-1 select-text border-t border-separator'>
                    {preForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}

                    {forEachEntry && (
                        <ContextRow
                            title={getNodeLabel(forEachEntry[0])}
                            subtitle={`${iterationCount} iteration${iterationCount !== 1 ? 's' : ''}`}
                            expanded={expandedKeys.has(forEachGroupKey)}
                            onToggle={() => toggleKey(forEachGroupKey)}
                        >
                            <div className='ml-3.5 border-l border-separator'>
                                <ContextRow
                                    title={`Iteration ${currentIndex}`}
                                    expanded={expandedKeys.has(iterationKey)}
                                    onToggle={() => toggleKey(iterationKey)}
                                >
                                    <div className='ml-3.5 border-l border-separator'>
                                        {postForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}
                                    </div>
                                </ContextRow>
                            </div>
                        </ContextRow>
                    )}

                    {!forEachEntry && postForEach.length === 0 && entries.length > preForEach.length &&
                        entries.slice(preForEach.length).map(([nodeId, output]) => renderEntry(nodeId, output))
                    }
                </Scrollable>
            )}
        </section>
    );
};

export default DebugContextPanel;
