import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/components/organisms/plugins/PluginBuilder';
import { usePluginBuilderStore } from '@/stores/slices/plugin';

const PluginBuilderPage = () => {
    const [searchParams] = useSearchParams();
    const pluginId = searchParams.get('id');
    const loadPluginById = usePluginBuilderStore((state) => state.loadPluginById);
    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);

    useEffect(() => {
        if(pluginId){
            loadPluginById(pluginId);
        }else{
            clearWorkflow();
        }
    }, [pluginId, loadPluginById, clearWorkflow]);

    return(
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
