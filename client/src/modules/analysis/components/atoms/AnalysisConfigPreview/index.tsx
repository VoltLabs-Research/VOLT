import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/presentation/utilities/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import Button from '@/shared/presentation/components/Button';
import Editor from '@monaco-editor/react';
import { RiCodeSSlashLine } from 'react-icons/ri';
import { useEffect, useMemo, useState } from 'react';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';

interface AnalysisConfigPreviewProps {
    analysis: Analysis;
};

const AnalysisConfigPreview = ({ analysis }: AnalysisConfigPreviewProps) => {
    const [monacoTheme, setMonacoTheme] = useState(() => getMonacoThemeName(getActiveAppTheme()));

    useEffect(() => {
        applyMonacoTheme();

        return subscribeToAppTheme((theme) => {
            setMonacoTheme(getMonacoThemeName(theme));
            applyMonacoTheme(theme);
        });
    }, []);

    const formattedConfig = useMemo(() => {
        return JSON.stringify(analysis.config || {}, null, 2);
    }, [analysis.config]);

    const trigger = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            className='analysis-config-preview-trigger'
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label={`View configuration for analysis ${analysis._id}`}
        >
            <RiCodeSSlashLine size={16} />
            View config
        </Button>
    );

    return (
        <Popover
            id={`analysis-config-preview-${analysis._id}`}
            trigger={trigger}
            placement='left-start'
            noPadding
            className='overflow-hidden'
        >
            <Container
                className='d-flex column'
                style={{ width: '32rem', maxWidth: '80vw' }}
                onClick={(event) => event.stopPropagation()}
            >
                <Container className='p-1 border-bottom border-subtle'>
                    <span className='font-size-2 font-weight-6 color-primary'>Analysis Config</span>
                </Container>
                <Editor
                    height='20rem'
                    language='json'
                    value={formattedConfig}
                    theme={monacoTheme}
                    loading={<Container className='p-1 color-secondary'>Loading editor...</Container>}
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        folding: true,
                        automaticLayout: true
                    }}
                />
            </Container>
        </Popover>
    );
};

export default AnalysisConfigPreview;
