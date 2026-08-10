import { Button } from '@heroui/react';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import {
    collectVisibleDefaultArgumentValues,
    getUserConfigurableArguments
} from '@/modules/plugin/utils/plugin/argument-values';
import { X, Play, Settings2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';

/**
 * `DebugArgumentsPanel.css`, as utilities. `center-x` and `panel-floating` were bravais
 * utility classes; the first is `left-1/2 -translate-x-1/2` and the second was never
 * defined anywhere in this app, so it is dropped rather than guessed at.
 */
const PANEL_CLASS = 'absolute top-14 left-1/2 z-10 flex w-[320px] max-h-[400px] max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface max-[768px]:w-[calc(100vw-1rem)] max-[768px]:max-h-[60dvh]';
const PANEL_HEADER_CLASS = 'flex shrink-0 flex-row items-center justify-between border-b border-border px-3 py-2.5';
const PANEL_BODY_CLASS = 'flex min-h-0 max-h-[280px] flex-1 flex-col gap-2 overflow-y-auto p-3 max-[768px]:max-h-[40dvh]';
const PANEL_FOOTER_CLASS = 'shrink-0 border-t border-border px-3 py-2.5';

interface DebugArgumentsPanelProps {
    onStart: () => void;
    canStart: boolean;
}

const DebugArgumentsPanel = ({ onStart, canStart }: DebugArgumentsPanelProps) => {
    const nodes = usePluginBuilderStore((s) => s.nodes);
    const {
        debugConfig,
        showArgumentsPanel,
        setDebugConfigField,
        setDebugConfig,
        setShowArgumentsPanel,
        isDebugging,
        isStarting
    } = usePluginDebugStore();

    const { selectedTrajectory } = useDebugTrajectorySelector();

    // Memoised: identity is load-bearing as a dependency of the defaults effect below.
    const configurableArgs = useMemo(() => {
        const argsDefinitions = nodes.find((n) => n.type === NodeType.ARGUMENTS)?.data.arguments?.arguments;
        return argsDefinitions ? getUserConfigurableArguments(argsDefinitions) : [];
    }, [nodes]);

    useEffect(() => {
        if (configurableArgs.length === 0) return;

        const defaultConfig = collectVisibleDefaultArgumentValues(configurableArgs, debugConfig);
        const newConfig: Record<string, unknown> = { ...debugConfig };
        let hasChanges = false;

        for (const [key, value] of Object.entries(defaultConfig)) {
            if (newConfig[key] === undefined) {
                newConfig[key] = value;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setDebugConfig(newConfig);
        }
    }, [configurableArgs, debugConfig, setDebugConfig]);

    const handleStartClick = () => {
        setShowArgumentsPanel(false);
        onStart();
    };

    if (configurableArgs.length === 0 || !showArgumentsPanel) return null;

    return (
        <div className={PANEL_CLASS}>
            <div className={PANEL_HEADER_CLASS}>
                <div className='flex flex-row items-center gap-2'>
                    <Settings2 size={14} aria-hidden='true' />
                    <p className='text-sm font-semibold'>
                        Debug Arguments
                    </p>
                </div>
                <Button
                    isIconOnly
                    variant='ghost'
                    size='sm'
                    aria-label='Close debug arguments'
                    onPress={() => setShowArgumentsPanel(false)}
                >
                    <X size={14} aria-hidden='true' />
                </Button>
            </div>

            <div className={PANEL_BODY_CLASS}>
                <ArgumentFieldsRenderer
                    arguments={configurableArgs}
                    values={debugConfig}
                    onChange={setDebugConfigField}
                    frameOptions={(selectedTrajectory?.frames ?? []).map((frame, index) => ({
                        value: String(frame.timestep),
                        title: `Frame ${index + 1} (t=${frame.timestep})`
                    }))}
                />
            </div>

            <div className={PANEL_FOOTER_CLASS}>
                {/* bravais `intent='white'` was the inverted fill, which is HeroUI's `primary` (spec §4d). */}
                <Button
                    variant='primary'
                    size='sm'
                    fullWidth
                    onPress={handleStartClick}
                    isDisabled={!canStart || isDebugging || isStarting}
                >
                    <Play size={12} aria-hidden='true' />
                    Start Debug
                </Button>
            </div>
        </div>
    );
};

export default DebugArgumentsPanel;
