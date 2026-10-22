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
import { X, Play } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

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
        <div className='glass-surface flex w-80 max-h-100 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-3xl bg-overlay shadow-[var(--overlay-shadow)] transition-[opacity,translate,scale] duration-200 ease-[var(--ease-emphasized)] starting:translate-y-2 starting:scale-96 starting:opacity-0 max-[768px]:w-[calc(100vw-1rem)] max-[768px]:max-h-[60dvh]'>
            <div className='flex shrink-0 flex-row items-center justify-between gap-3 pt-3.5 pr-2.5 pb-2.5 pl-5'>
                <p className='text-base font-semibold'>
                    Debug Arguments
                </p>
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
            <Scrollable className='flex min-h-0 max-h-[280px] flex-1 flex-col gap-3 px-5 pt-1 pb-4 max-[768px]:max-h-[40dvh]'>
                <ArgumentFieldsRenderer
                    arguments={configurableArgs}
                    values={debugConfig}
                    onChange={setDebugConfigField}
                    frameOptions={(selectedTrajectory?.frames ?? []).map((frame, index) => ({
                        value: String(frame.timestep),
                        title: `Frame ${index + 1} (t=${frame.timestep})`
                    }))}
                />
            </Scrollable>
            <div className='shrink-0 border-t border-separator px-4 pt-3 pb-4'>
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
