import { useEffect } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/modules/plugins/presentation/components/organisms/PluginBuilder';
import { usePluginBuilderStore } from '@/modules/plugins/presentation/stores/builder-slice';

const PluginBuilderPage = () => {
    usePageTitle('Plugin Builder');
    const [searchParams] = useSearchParams();
    const pluginId = searchParams.get('id');
    const loadPluginById = usePluginBuilderStore((state) => state.loadPluginById);
    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);

    useEffect(() => {
        if (pluginId) {
            loadPluginById(pluginId);
        } else {
            clearWorkflow();
        }
    }, [pluginId, loadPluginById, clearWorkflow]);

    return (
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
