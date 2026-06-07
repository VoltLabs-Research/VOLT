import './AvatarUpload.css';
import { Box, Button, Heading, Loader, Row, Stack, Text } from '@voltstack/bravais';
import { Camera, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface AvatarUploadProps {
    avatarUrl: string | null;
    isUploading: boolean;
    onUpload: (file: File) => Promise<void>;
}

const AvatarUpload = ({
    avatarUrl,
    isUploading,
    onUpload
}: AvatarUploadProps) => {
    const helperTextId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    useEffect(() => {
        setPreview(avatarUrl);
    }, [avatarUrl]);

    const handleAvatarTrigger = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file){
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setPreview(reader.result);
            }
        };
        reader.readAsDataURL(file);

        try{
            await onUpload(file);
        }catch {
            setPreview(avatarUrl);
        }
    };

    let avatarContent = (
        <Row width='max' height='max' justify='center' className='avatar-placeholder'>
            <User size={32} />
        </Row>
    );

    if (preview) {
        avatarContent = <img src={preview} alt="Avatar" className="avatar-image" />;
    }

    let overlayContent = <Camera size={24} />;

    if (isUploading) {
        overlayContent = <Loader scale={0.6} isFixed={false} />;
    }

    return (
        <Row gap='1'>
            <Button
                type='button'
                variant='ghost'
                align='start'
                className='avatar-upload-trigger d-flex items-center gap-1 p-0'
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <Box position='relative' radius='full' overflow='hidden' shrink='0' className='avatar-upload'>
                    {avatarContent}
                    <Row position='absolute' inset='0' className='avatar-overlay r'>
                        {overlayContent}
                    </Row>
                </Box>

                <Stack gap='025' style={{ textAlign: 'left' }}>
                    <Heading level={3} size='md' weight='bold'>
                        Profile Picture
                    </Heading>
                    <Text as='div' id={helperTextId} tone='muted' size='sm'>
                        Click to upload a new avatar (JPG, PNG, max 5MB)
                    </Text>
                </Stack>
            </Button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="d-none"
                tabIndex={-1}
                aria-hidden='true'
            />
        </Row>
    );
};

export default AvatarUpload;
