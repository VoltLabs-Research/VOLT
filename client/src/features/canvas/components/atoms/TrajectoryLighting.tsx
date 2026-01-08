
const TrajectoryLighting = () => (
    <>
        <ambientLight intensity={0.8} />
        <directionalLight
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
        <directionalLight
            position={[-10, 10, -10]}
            intensity={0.8}
            color="#ffffff"
        />
        <hemisphereLight
            groundColor="#362d1d"
            intensity={0.5}
        />
    </>
);

export default TrajectoryLighting;
