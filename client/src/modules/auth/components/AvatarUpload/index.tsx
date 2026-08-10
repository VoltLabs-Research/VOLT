import { Spinner } from '@heroui/react';
import { Camera, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

/*
 * The trigger stays a plain `<button>` rather than becoming a HeroUI `Button`.
 * HeroUI's `.button` fixes its own height, radius and `white-space`, and rewrites
 * every descendant `svg` to `size-5 sm:size-4` — which would shrink the 32px
 * placeholder head and the 24px camera glyph inside this 80px avatar. This press
 * target is a composite tile, not a button-shaped control, so it keeps native
 * `onClick` / `disabled` semantics and its whole surface is described by utilities.
 *
 * The hover/focus reveal of the camera overlay was
 * `.avatar-upload-trigger:hover .avatar-overlay { opacity: 1 }`; it is the
 * `group` / `group-hover:` pair now, which is the same thing said on the element.
 */
const TRIGGER = 'group flex min-h-20 w-fit items-center gap-4 text-left';
const AVATAR = 'relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-border';
const OVERLAY = 'absolute inset-0 flex flex-row items-center bg-[color-mix(in_srgb,var(--background)_55%,transparent)] text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100';

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
        overlayContent = <Spinner size='sm' color='current' />;
    }

    return (
        <div className='flex flex-row items-center gap-4'>
            <button
                type='button'
                className={TRIGGER}
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <div className={AVATAR}>
                    {avatarContent}
                    <div className={OVERLAY}>
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
