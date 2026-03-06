import { useRef, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Text, Grid, Environment, ContactShadows,
  PerspectiveCamera, RoundedBox, Sky, Preload, AdaptiveDpr,
} from '@react-three/drei';
import * as THREE from 'three';

// ─── Helpers ────────────────────────────────────────────────────────────────
function profileToSize(prof) {
  return [(prof?.w ?? 10) / 100, (prof?.h ?? 10) / 100];
}

function getMaterialColor(mat, finish) {
  if (finish?.hex && finish.hex !== '#C49A3C') return finish.hex;
  return mat?.color ?? '#8B6914';
}

// ─── Material Factory ───────────────────────────────────────────────────────
function usePergolaMat(color, category) {
  return useMemo(() => {
    if (category === 'wood') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
    }
    if (category === 'aluminum') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.88, envMapIntensity: 0.7 });
    }
    return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.92, envMapIntensity: 0.6 });
  }, [color, category]);
}

// ─── Rounded Beam (universal) ───────────────────────────────────────────────
function RBeam({ x, y, z, length, direction = 'x', profile, color, category }) {
  const mat = usePergolaMat(color, category);
  const [w, h] = profileToSize(profile);
  const isX = direction === 'x';
  const radius = Math.min(w, h) * 0.1;
  return (
    <RoundedBox
      args={isX ? [length, h, w] : [w, h, length]}
      radius={radius} smoothness={4}
      position={[
        isX ? x + length / 2 : x,
        y + h / 2,
        isX ? z : z + length / 2,
      ]}
      castShadow receiveShadow
      material={mat}
    />
  );
}

// ─── Column ─────────────────────────────────────────────────────────────────
function Column({ x, y, z, height, profile, color, category }) {
  const mat = usePergolaMat(color, category);
  const [w, h] = profileToSize(profile);
  const radius = Math.min(w, h) * 0.12;
  return (
    <group>
      <RoundedBox
        args={[w, height, h]}
        radius={radius} smoothness={4}
        position={[x, height / 2 + y, z]}
        castShadow receiveShadow
        material={mat}
      />
      {/* Small base plate */}
      <mesh position={[x, 0.01, z]} receiveShadow>
        <boxGeometry args={[w * 1.8, 0.02, h * 1.8]} />
        <meshStandardMaterial color="#666" roughness={0.5} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Roof Sheet ─────────────────────────────────────────────────────────────
function RoofSheet({ x, y, z, width, length, roofType }) {
  const isTransparent = roofType === 'polycarbonate';
  const isFabric = roofType === 'fabricRetractable';
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: isFabric ? '#F5E6CC' : isTransparent ? '#DCEFFA' : '#D0D8E0',
    transparent: true,
    opacity: isTransparent ? 0.3 : isFabric ? 0.55 : 0.8,
    roughness: isFabric ? 0.85 : 0.1,
    metalness: 0,
    transmission: isTransparent ? 0.6 : 0,
    thickness: 0.01,
    side: THREE.DoubleSide,
  }), [roofType]);
  return (
    <mesh position={[x + length / 2, y + 0.005, z + width / 2]} receiveShadow material={mat}>
      <boxGeometry args={[length, 0.008, width]} />
    </mesh>
  );
}

// ─── Wall ───────────────────────────────────────────────────────────────────
function Wall({ wallData }) {
  if (!wallData) return null;
  return (
    <mesh position={[wallData.width / 2, wallData.height / 2, -0.12]} receiveShadow>
      <boxGeometry args={[wallData.width + 0.5, wallData.height, 0.24]} />
      <meshStandardMaterial color="#E8E0D4" roughness={0.92} metalness={0} />
    </mesh>
  );
}

// ─── Ground ─────────────────────────────────────────────────────────────────
function Ground({ width, length }) {
  return (
    <group>
      {/* Deck area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[length / 2, -0.005, width / 2]} receiveShadow>
        <planeGeometry args={[length + 1.5, width + 1.5]} />
        <meshStandardMaterial color="#C9B896" roughness={0.92} metalness={0} />
      </mesh>
      {/* Grass surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[length / 2, -0.015, width / 2]} receiveShadow>
        <planeGeometry args={[length + 8, width + 8]} />
        <meshStandardMaterial color="#7CB342" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Dimension Lines ────────────────────────────────────────────────────────
function DimensionLine({ start, end, label }) {
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const midZ = (start[2] + end[2]) / 2;
  const pts = useMemo(() => new Float32Array([...start, ...end]), [start, end]);
  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={pts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#EF4444" linewidth={2} />
      </line>
      <Text position={[midX, midY + 0.08, midZ]} fontSize={0.1} color="#EF4444" anchorX="center" anchorY="bottom" font={undefined}>
        {label}
      </Text>
    </group>
  );
}

// ─── Scene ──────────────────────────────────────────────────────────────────
function PergolaScene({ result, showDims, showGrid }) {
  const { layout3D, profiles, material, finishData, input, structure, roof } = result;
  const color = getMaterialColor(material, finishData);
  const category = material.category;
  const { length, width, height } = input;

  return (
    <>
      {/* Lighting setup */}
      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow position={[10, 15, 8]} intensity={1.8}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-12} shadow-camera-right={12}
        shadow-camera-top={12} shadow-camera-bottom={-12}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-6, 10, -4]} intensity={0.3} />
      <hemisphereLight args={['#87CEEB', '#7CB342', 0.3]} />

      {/* Sky */}
      <Sky sunPosition={[50, 30, 20]} turbidity={3} rayleigh={0.5} mieCoefficient={0.005} />
      <Environment preset="park" background={false} />

      {/* Ground */}
      <Ground width={width} length={length} />
      {showGrid && (
        <Grid
          position={[length / 2, 0.001, width / 2]}
          args={[20, 20]} cellSize={0.5} cellColor="#BBB"
          sectionSize={1} sectionColor="#888" fadeDistance={15}
        />
      )}
      <ContactShadows position={[length / 2, 0.002, width / 2]} opacity={0.4} scale={16} blur={2.5} far={6} />

      {/* Wall */}
      {layout3D.wall && <Wall wallData={layout3D.wall} />}

      {/* Columns */}
      {layout3D.columns.map((col, i) => (
        <Column key={`col-${i}`} {...col} profile={profiles.column} color={color} category={category} />
      ))}

      {/* Main Beams */}
      {layout3D.mainBeams.map((b, i) => (
        <RBeam key={`mb-${i}`} {...b} profile={profiles.mainBeam} color={color} category={category} />
      ))}

      {/* Secondary Beams */}
      {layout3D.secBeams.map((b, i) => (
        <RBeam key={`sb-${i}`} {...b} profile={profiles.secBeam} color={color} category={category} />
      ))}

      {/* Rafters */}
      {layout3D.rafters.map((r, i) => (
        <RBeam key={`raft-${i}`} {...r} profile={profiles.rafter} color={color} category={category} />
      ))}

      {/* Roof Sheet for solid types */}
      {['polycarbonate', 'polycarbonateOpaque', 'fabricRetractable'].includes(input.roofType) && (
        <RoofSheet
          x={-structure.overhangM}
          y={height + (profiles.mainBeam?.h ?? 10) / 100 + (profiles.secBeam?.h ?? 10) / 100 + (profiles.rafter?.h ?? 5) / 100}
          z={input.installType === 'wallMounted' ? 0 : -(structure.overhangM)}
          width={input.installType === 'wallMounted' ? width + structure.overhangM : width + structure.overhangM * 2}
          length={length + structure.overhangM * 2}
          roofType={input.roofType}
        />
      )}

      {/* Dimensions */}
      {showDims && (
        <>
          <DimensionLine
            start={[0, 0.05, width + 0.6]}
            end={[length, 0.05, width + 0.6]}
            label={`${length.toFixed(1)}m`}
          />
          <DimensionLine
            start={[length + 0.6, 0.05, 0]}
            end={[length + 0.6, 0.05, width]}
            label={`${width.toFixed(1)}m`}
          />
          <DimensionLine
            start={[-0.6, 0, 0]}
            end={[-0.6, height, 0]}
            label={`${height.toFixed(1)}m`}
          />
        </>
      )}
    </>
  );
}

// ─── Export ─────────────────────────────────────────────────────────────────
export default function PergolaViewer3D({ result, mobile }) {
  const [showDims, setShowDims] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const { length = 4, width = 3 } = result?.input ?? {};
  const cx = length / 2, cz = width / 2;
  const h = mobile ? 'h-[52vh]' : 'h-[600px]';

  if (!result) {
    return (
      <div className={`w-full ${h} bg-gradient-to-b from-sky-50 to-neutral-100 flex items-center justify-center text-neutral-400 text-sm`}>
        הגדר פרמטרים כדי לראות תצוגה תלת-ממדית
      </div>
    );
  }

  return (
    <div className={`relative w-full ${h} bg-gradient-to-b from-sky-200/60 to-sky-50`}>
      {/* Overlay controls */}
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        <button
          onClick={() => setShowDims(d => !d)}
          className={`text-[10px] px-2.5 py-1 rounded-full font-medium backdrop-blur transition ${
            showDims ? 'bg-red-500/90 text-white' : 'bg-white/70 text-neutral-600 hover:bg-white/90'
          }`}
        >
          מידות
        </button>
        <button
          onClick={() => setShowGrid(g => !g)}
          className={`text-[10px] px-2.5 py-1 rounded-full font-medium backdrop-blur transition ${
            showGrid ? 'bg-blue-500/90 text-white' : 'bg-white/70 text-neutral-600 hover:bg-white/90'
          }`}
        >
          רשת
        </button>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          powerPreference: 'high-performance',
        }}
      >
        <AdaptiveDpr pixelated />
        <PerspectiveCamera
          makeDefault
          position={[cx + length * 0.9, length * 0.7, cz + width * 1.4]}
          fov={mobile ? 50 : 38}
          near={0.1} far={200}
        />
        <OrbitControls
          target={[cx, (result?.input?.height ?? 2.7) * 0.45, cz]}
          minDistance={1.5} maxDistance={30}
          minPolarAngle={0.1} maxPolarAngle={Math.PI / 2 - 0.03}
          enableDamping dampingFactor={0.06}
          enablePan={!mobile}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
        <PergolaScene result={result} showDims={showDims} showGrid={showGrid} />
        <Preload all />
      </Canvas>
    </div>
  );
}
