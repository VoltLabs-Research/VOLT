import { useState, useCallback, useMemo } from 'react';
import { usePluginDebugStore } from '@/modules/plugin/stores/use-plugin-debug-store';
import { usePluginBuilderStore } from '@/modules/plugin/stores/use-plugin-builder-store';
import JsonTree from '@/modules/plugin/components/atoms/JsonTree';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Braces, ChevronDown, ChevronRight, X, Repeat } from 'lucide-react';
import './DebugContextPanel.css';

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

    const toggleKey = useCallback((key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const { preForEach, forEachEntry, postForEach, currentIndex } = useMemo(() => {
        if (!forEachNodeId) {
            return { preForEach: entries, forEachEntry: null, postForEach: [], currentIndex: 0 };
        }

        const orderIds = executionOrder.map((e) => e.nodeId);
        const forEachPos = orderIds.indexOf(forEachNodeId);

        if (forEachPos === -1) {
            return { preForEach: entries, forEachEntry: null, postForEach: [], currentIndex: 0 };
        }

        const preIds = new Set(orderIds.slice(0, forEachPos));
        const postIds = new Set(orderIds.slice(forEachPos + 1));

        const pre: [string, Record<string, any>][] = [];
        let feEntry: [string, Record<string, any>] | null = null;
        const post: [string, Record<string, any>][] = [];

        for (const [nodeId, output] of entries) {
            if (nodeId === forEachNodeId) feEntry = [nodeId, output];
            else if (preIds.has(nodeId)) pre.push([nodeId, output]);
            else if (postIds.has(nodeId)) post.push([nodeId, output]);
        }

        const idxOf = (id: string) => orderIds.indexOf(id);
        pre.sort((a, b) => idxOf(a[0]) - idxOf(b[0]));
        post.sort((a, b) => idxOf(a[0]) - idxOf(b[0]));

        return { preForEach: pre, forEachEntry: feEntry, postForEach: post, currentIndex: feEntry?.[1].currentIndex ?? 0 };
    }, [entries, forEachNodeId, executionOrder]);

    if (!isDebugging || !hasData) return null;

    const getNodeLabel = (nodeId: string): string => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return nodeId;
        const label = (node.data as any)?.label;
        return label || (node.type ?? '').charAt(0).toUpperCase() + (node.type ?? '').slice(1);
    };

    const Chevron = ({ expanded, size = 11 }: { expanded: boolean; size?: number }) =>
        expanded ? <ChevronDown size={size} /> : <ChevronRight size={size} />;

    const renderEntry = (nodeId: string, output: Record<string, any>) => {
        const isExpanded = expandedKeys.has(nodeId);
        return (
            <Container key={nodeId} className='debug-context-entry'>
                <Container
                    className='debug-context-row d-flex items-center content-between gap-05 cursor-pointer'
                    onClick={() => toggleKey(nodeId)}
                >
                    <Container className='d-flex column'>
                        <Paragraph className='debug-context-label'>{getNodeLabel(nodeId)}</Paragraph>
                        <Paragraph className='debug-context-id color-muted'>{nodeId}</Paragraph>
                    </Container>
                    <Chevron expanded={isExpanded} />
                </Container>
                {isExpanded && (
                    <Container className='debug-context-tree'>
                        <JsonTree data={output} defaultExpanded={true} />
                    </Container>
                )}
            </Container>
        );
    };

    const iterationKey = `__iteration_${currentIndex}`;
    const forEachGroupKey = '__foreach_group';
    const iterationCount = forEachEntry?.[1].count ?? totalIterations;

    return (
        <Container className='debug-context-panel p-absolute d-flex column panel-floating top-1 right-1 z-10'>
            <Container
                className='debug-context-row debug-context-panel-header d-flex items-center content-between gap-05 cursor-pointer u-select-none'
                onClick={() => setIsOpen((v) => !v)}
            >
                <Braces size={12} />
                <Paragraph className='debug-context-panel-title d-flex items-center gap-035 f-1 font-size-05 font-weight-6'>
                    Context
                    <span className='debug-context-panel-count radius-full font-weight-6'>{entries.length}</span>
                </Paragraph>
                {isOpen
                    ? <X size={12} className='color-secondary' />
                    : <ChevronRight size={12} />}
            </Container>

            {isOpen && (
                <Container className='debug-context-panel-body nowheel y-auto flex-1 min-h-0 scrollbar-thin'>
                    {preForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}

                    {forEachEntry && (
                        <Container className='debug-context-entry'>
                            <Container
                                className='debug-context-row d-flex items-center content-between gap-05 cursor-pointer'
                                onClick={() => toggleKey(forEachGroupKey)}
                            >
                                <Container className='d-flex items-center gap-05'>
                                    <Repeat size={10} className='color-muted' />
                                    <Container className='d-flex column'>
                                        <Paragraph className='debug-context-label'>{getNodeLabel(forEachEntry[0])}</Paragraph>
                                        <Paragraph className='debug-context-id color-muted'>
                                            {iterationCount} iteration{iterationCount !== 1 ? 's' : ''}
                                        </Paragraph>
                                    </Container>
                                </Container>
                                <Chevron expanded={expandedKeys.has(forEachGroupKey)} />
                            </Container>

                            {expandedKeys.has(forEachGroupKey) && (
                                <Container className='debug-context-nested'>
                                    <Container className='debug-context-entry'>
                                        <Container
                                            className='debug-context-row d-flex items-center content-between gap-05 cursor-pointer'
                                            onClick={() => toggleKey(iterationKey)}
                                        >
                                            <Paragraph className='debug-context-label'>Iteration {currentIndex}</Paragraph>
                                            <Chevron expanded={expandedKeys.has(iterationKey)} size={10} />
                                        </Container>

                                        {expandedKeys.has(iterationKey) && (
                                            <Container className='debug-context-nested'>
                                                {postForEach.map(([nodeId, output]) => renderEntry(nodeId, output))}
                                            </Container>
                                        )}
                                    </Container>
                                </Container>
                            )}
                        </Container>
                    )}

                    {!forEachEntry && postForEach.length === 0 && entries.length > preForEach.length &&
                        entries.slice(preForEach.length).map(([nodeId, output]) => renderEntry(nodeId, output))
                    }
                </Container>
            )}
        </Container>
    );
};

export default DebugContextPanel;
