import React from 'react';
import type { HeaderProps } from '@/types/raster';
import { BsArrowLeft } from 'react-icons/bs';
import { IoLogInOutline, IoSearchOutline } from 'react-icons/io5';
import { RxEyeOpen } from 'react-icons/rx';
import { motion } from 'framer-motion';
import { TbCube3dSphere } from 'react-icons/tb';
import RasterTrajectoryDetailsSkeleton from '@/modules/raster/presentation/components/atoms/RasterTrajectoryDetailsSkeleton';
import RasterSceneViewsSkeleton from '@/modules/raster/presentation/components/atoms/RasterSceneViewsSkeleton';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';

const Header: React.FC<HeaderProps> = ({ trajectory, isLoading, onGoBack, onView3D, onSignIn, connectedUsers }) => {
    return (
        <div className='d-flex content-between items-center raster-scene-header-container color-primary'>
            <div className='d-flex items-center gap-2 raster-scene-header-left-container p-1'>
                <Tooltip content="Go Back" placement="bottom">
                    <i className='d-flex flex-center raster-scene-header-go-back-icon-container color-primary cursor-pointer' onClick={onGoBack}>
                        <BsArrowLeft />
                    </i>
                </Tooltip>

                <div className='d-flex column gap-05 raster-scene-header-team-container'>
                    {isLoading ? (
                        <RasterTrajectoryDetailsSkeleton />
                    ) : (
                        <>
                            <Title className='font-size-3 raster-scene-header-title'>
                                {trajectory?.name || 'Loading...'}
                            </Title>

                            <Paragraph className='raster-scene-header-last-edited'>Last Edited by Rodolfo H</Paragraph>
                        </>
                    )}
                </div>
            </div>

            <div className='d-flex flex-center items-center gap-1-5 raster-scene-header-search-container'>
                <div className="d-flex items-center gap-05 raster-scene-header-users-container">
                    {(() => {
                        const users = connectedUsers ?? [];
                        const shown = users.slice(0, 2);
                        const extra = users.length - shown.length;

                        const getInitials = (u: any) => {
                            const f = u.firstName?.[0] ?? '';
                            const l = u.lastName?.[0] ?? '';
                            if (f || l) return `${f}${l}`.toUpperCase();
                            const name = u.name ?? u.email ?? '';
                            const parts = String(name).trim().split(/\s+/);
                            return (parts[0]?.[0] ?? '?').toUpperCase();
                        };

                        return (
                            <>
                                {shown.map((u) => (
                                    <div
                                        key={(u as any).id ?? u._id}
                                        title={[u.firstName, u.lastName].filter(Boolean).join(' ') || (u as any).name || u.email}
                                        className="d-flex flex-center connected-user-container color-primary"
                                        aria-label={`Usuario conectado: ${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()}
                                    >
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.firstName} className="connected-user-avatar-img" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            getInitials(u)
                                        )}
                                    </div>
                                ))}

                                {extra > 0 && (
                                    <div
                                        className="d-flex flex-center connected-user-container connected-user-extra color-primary"
                                        title={`${extra} más`}
                                        aria-label={`${extra} usuarios más`}
                                    >
                                        +{extra}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className='dashboard-search-container'>
                    <div className='d-flex gap-1 search-container color-primary'>
                        <i className='search-icon-container font-size-3 color-muted'>
                            <IoSearchOutline />
                        </i>

                        <input
                            placeholder='Search uploaded team trajectories'
                            className='search-input h-max w-max font-size-2 color-primary' />
                    </div>
                </div>

                {isLoading ? (
                    <RasterSceneViewsSkeleton />
                ) : (
                    <div className='d-flex items-center gap-1 raster-scene-header-views-container'>
                        <i className='raster-scene-header-views-icon-container'>
                            <RxEyeOpen />
                        </i>

                        <Paragraph className='raster-scene-header-views'>{trajectory?.rasterSceneViews} views</Paragraph>
                    </div>
                )}
            </div>

            <div className='d-flex content-end items-center gap-075 raster-scene-header-nav-container'>
                <motion.button
                    className='d-flex items-center gap-05 btn-3d p-relative overflow-hidden cursor-pointer'
                    aria-label='View in 3D'
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onView3D}
                >
                    <span className='btn-3d-glow' />
                    <TbCube3dSphere size={18} />
                    <span>View in 3D</span>
                </motion.button>

                {/* Mostrar botón de inicio de sesión solo si no hay usuario autenticado */}
                {onSignIn && (
                    <motion.button
                        className='d-flex items-center gap-05 btn-signin p-relative overflow-hidden color-primary cursor-pointer'
                        aria-label='Sign in'
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onSignIn}
                    >
                        <span className='btn-signin-glow' />
                        <IoLogInOutline size={18} />
                        <span>Sign In</span>
                    </motion.button>
                )}
            </div>
        </div>
    );
};

export default Header;
