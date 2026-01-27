
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;
const HemisphereLight = 'hemisphereLight' as any;

const TrajectoryLighting = () => (
    <>
        <AmbientLight intensity={0.8} />
        <DirectionalLight
            castShadow
            position={[15, 15, 15]}
            intensity={2.0}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={100}
            shadow-camera-near={1}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
        />
        <DirectionalLight
            position={[-10, 10, -10]}
            intensity={0.8}
            color="#ffffff"
        />
        <HemisphereLight
            groundColor="#362d1d"
            intensity={0.5}
        />
    </>
);

export default TrajectoryLighting;
