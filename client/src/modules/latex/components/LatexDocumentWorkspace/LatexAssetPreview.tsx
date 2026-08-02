import latexService from '@/modules/latex/api/service';
import LatexPdfViewer from './LatexPdfViewer';
import { getAssetDisplayName, isWorkspaceImageFile, isWorkspacePdfFile } from '@/modules/latex/utils/workspace';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';

interface LatexAssetPreviewProps {
    asset: LatexAsset;
}

/**
 * Asset URLs are signed, so the bytes are fetched through the API client and
 * handed to the DOM as a short-lived object URL.
*/
const useAuthedAssetUrl = ({ url, documentId }: Pick<LatexAsset, 'url' | 'documentId'>): string | null => {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

    useEffect(() => {
        const key = new URL(url, window.location.origin).searchParams.get('key');
        if (!key) {
            setResolvedUrl(null);
            return;
        }

        let objectUrl: string | null = null;
        let cancelled = false;

        latexService.getAssetContent({
            documentId,
            key
        })
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setResolvedUrl(objectUrl);
            })
            .catch(() => {
                if (!cancelled) setResolvedUrl(null);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url, documentId]);

    return resolvedUrl;
};

const LatexAssetPreview = ({ asset }: LatexAssetPreviewProps) => {
    const resolvedAssetUrl = useAuthedAssetUrl(asset);

    const openAsset = (): void => {
        if (resolvedAssetUrl) {
            window.open(resolvedAssetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    if (isWorkspacePdfFile(asset.path, asset.mimetype)) {
        return (
            <LatexPdfViewer
                pdfUrl={resolvedAssetUrl}
                onDownload={openAsset}
                downloadLabel='Open PDF'
            />
        );
    }

    if (isWorkspaceImageFile(asset.path, asset.mimetype)) {
        return (
            <Row height='max' p='1' overflow='auto' className='flex-center'>
                <img
                    src={resolvedAssetUrl ?? undefined}
                    alt={getAssetDisplayName(asset)}
                    className='mw-max mh-max object-contain'
                />
            </Row>
        );
    }

    return (
        <Stack align='center' gap='1' p='2' textAlign='center' className='h-100 flex-center'>
            <FileText size={28} className='color-muted' />
            <Text as='p' tone='muted'>
                This file can&apos;t be previewed inline.
            </Text>
            <Button
                variant='ghost'
                intent='brand'
                size='sm'
                shape='rounded'
                disabled={!resolvedAssetUrl}
                onClick={openAsset}
            >
                <Download size={14} />
                Open file
            </Button>
        </Stack>
    );
};

export default LatexAssetPreview;
