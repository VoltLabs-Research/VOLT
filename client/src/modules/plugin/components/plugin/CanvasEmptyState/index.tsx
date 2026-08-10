import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { Button } from '@heroui/react';
import {
    EMPTY_STATE_CARD_CLASS,
    EMPTY_STATE_CLASS,
    EMPTY_STATE_DESCRIPTION_CLASS,
    EMPTY_STATE_FLOW_CLASS,
    EMPTY_STATE_ICON_CLASS
} from '@/modules/plugin/components/plugin/PluginBuilder/builder-styles';
import { PlugZap, ArrowRight, ChevronRight } from 'lucide-react';

const WORKFLOW_STEPS = ['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'];

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    return (
        <div className={EMPTY_STATE_CLASS}>
            <div className={EMPTY_STATE_CARD_CLASS}>
                <div className={EMPTY_STATE_ICON_CLASS}>
                    <PlugZap size={28} aria-hidden='true' />
                </div>

                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-xl font-semibold text-foreground'>
                        Start building your plugin
                    </h3>
                    <p className={EMPTY_STATE_DESCRIPTION_CLASS}>
                        Drag nodes from the palette on the left, or add a Modifier node to get started with the plugin workflow.
                    </p>
                </div>

                {/* bravais `variant='solid' intent='brand'` — the accent fill — is HeroUI's `primary` (spec §4d). */}
                <Button
                    variant='primary'
                    size='sm'
                    onPress={() => addNode(NodeType.MODIFIER, {
                        x: 250,
                        y: 250
                    })}
                >
                    Add Modifier Node
                    <ArrowRight size={16} aria-hidden='true' />
                </Button>

                <div className={EMPTY_STATE_FLOW_CLASS}>
                    {WORKFLOW_STEPS.map((step, i, arr) => (
                        <span className='flex flex-row items-center gap-1 text-xs text-muted' key={step}>
                            {step}
                            {i < arr.length - 1 && <ChevronRight size={10} aria-hidden='true' />}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CanvasEmptyState;
