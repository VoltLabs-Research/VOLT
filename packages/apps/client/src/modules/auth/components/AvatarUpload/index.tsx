
import Loader from '@/shared/ui/components/Loader';
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
        <div className='flex size-full flex-row items-center justify-center bg-default text-muted'>
            <User size={32} />
        </div>
    );

    if (preview) {
        avatarContent = <img src={preview} alt="Avatar" className='size-full object-cover' />;
    }

    let overlayContent = <Camera size={24} />;

    if (isUploading) {
        overlayContent = <Loader size='sm' color='current' />;
    }

    return (
        <div className='flex flex-row items-center gap-4'>
            <button
                type='button'
                className='group flex min-h-20 w-fit items-center gap-4 text-left'
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <div className='relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-border'>
                    {avatarContent}
                    <div className='absolute inset-0 flex flex-row items-center bg-[color-mix(in_srgb,var(--background)_55%,transparent)] text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100'>
                        {overlayContent}
                    </div>
                </div>
                <div className='flex flex-col gap-1 text-left'>
                    <h3 className='text-sm font-semibold text-foreground'>
                        Profile Picture
                    </h3>
                    <div className='text-xs text-muted' id={helperTextId}>
                        Click to upload a new avatar (JPG, PNG, max 5MB)
                    </div>
                </div>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                tabIndex={-1}
                aria-hidden='true'
            />
        </div>
    );
};

export default AvatarUpload;
