import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { ArrowLeft } from 'lucide-react';
import type { ComponentProps } from 'react';

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;
type ExcalidrawAPICallback = NonNullable<ExcalidrawProps['excalidrawAPI']>;
type ExcalidrawAPI = Parameters<ExcalidrawAPICallback>[0];
type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps['onChange']>;
type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

export interface WhiteboardCanvasProps {
    name: string;
    initialData: ExcalidrawProps['initialData'];
    onChange: ExcalidrawChangeHandler;
    generateIdForFile: ExcalidrawProps['generateIdForFile'];
    renderTopRightUI: RenderTopRightUI;
    onExcalidrawAPI: (api: ExcalidrawAPI) => void;
    onBack: () => void;
};

const BackIcon = <ArrowLeft size={16} />;

/**
 * Thin wrapper that co-locates Excalidraw and MainMenu in the same
 * dynamic chunk. Must be imported via React.lazy() to keep the large
 * Excalidraw bundle out of the initial JS payload.
 */
const WhiteboardCanvas = ({
    name,
    initialData,
    onChange,
    generateIdForFile,
    renderTopRightUI,
    onExcalidrawAPI,
    onBack
}: WhiteboardCanvasProps) => (
    <Excalidraw
        name={name}
        excalidrawAPI={onExcalidrawAPI}
        initialData={initialData}
        onChange={onChange}
        generateIdForFile={generateIdForFile}
        renderTopRightUI={renderTopRightUI}
    >
        <MainMenu>
            <MainMenu.Item icon={BackIcon} onSelect={onBack}>
                Back to Whiteboards
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
    </Excalidraw>
);

export default WhiteboardCanvas;
