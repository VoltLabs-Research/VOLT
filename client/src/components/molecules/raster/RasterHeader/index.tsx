import React from 'react';
import type { HeaderProps } from '@/types/raster';
import { BsArrowLeft } from 'react-icons/bs';
import { IoLogInOutline, IoSearchOutline } from 'react-icons/io5';
import { RxEyeOpen } from 'react-icons/rx';
import { motion } from 'framer-motion';
import { TbCube3dSphere } from 'react-icons/tb';
import RasterTrajectoryDetailsSkeleton from '@/components/atoms/raster/RasterTrajectoryDetailsSkeleton';
import RasterSceneViewsSkeleton from '@/components/atoms/raster/RasterSceneViewsSkeleton';

const Header: React.FC<HeaderProps> = ({ trajectory, isLoading, onGoBack, onView3D, onSignIn, connectedUsers }) => {
    return(
        <div className='raster-scene-header-container'>
            <div className='raster-scene-header-left-container'>
                <i className='raster-scene-header-go-back-icon-container' onClick={onGoBack}>
                    <BsArrowLeft />
                </i>

                <div className='raster-scene-header-team-container'>
                    {isLoading ? (
                        <RasterTrajectoryDetailsSkeleton />
                    ) : (
                        <>
                            <h3 className='raster-scene-header-title'>
                              {trajectory?.name || 'Loading...'}
                            </h3>

                            <p className='raster-scene-header-last-edited'>Last Edited by Rodolfo H</p>
                        </>
                    )}
                </div>
            </div>

            <div className='raster-scene-header-search-container'>
                <div className="raster-scene-header-users-container">
                    {(() => {
                        const users = connectedUsers ?? [];
                        const shown = users.slice(0, 2);
                        const extra = users.length - shown.length;

                        const getInitials = (u: any) => {
                            const f = u.firstName?.[0] ?? '';
                            const l = u.lastName?.[0] ?? '';
                            if(f || l) return `${f}${l}`.toUpperCase();
                            const name = u.name ?? u.email ?? '';
                            const parts = String(name).trim().split(/\s+/);
                            return(parts[0]?.[0] ?? '?').toUpperCase();
                        };

                        return(
                            <>
                                {shown.map((u) => (
                                    <div
                                        key={(u as any).id ?? u._id}
                                        title={[u.firstName, u.lastName].filter(Boolean).join(' ') || (u as any).name || u.email}
                                        className="connected-user-container"
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
                                        className="connected-user-container connected-user-extra"
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
                    <div className='search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>

                        <input
                            placeholder='Search uploaded team trajectories'
                            className='search-input' />
                    </div>
                </div>

                {isLoading ? (
                    <RasterSceneViewsSkeleton />
                ) : (
                    <div className='raster-scene-header-views-container'>
                        <i className='raster-scene-header-views-icon-container'>
                            <RxEyeOpen />
                        </i>

                        <p className='raster-scene-header-views'>{trajectory?.rasterSceneViews} views</p>
                    </div>
                )}
            </div>

            <div className='raster-scene-header-nav-container'>
                <motion.button
                    className='btn-3d'
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
                        className='btn-signin'
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
