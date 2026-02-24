import { AbsoluteFill } from 'remotion';

export const Video: React.FC<{
  seed: string;
  friction: number;
  pressure: number;
}> = ({ seed, friction, pressure }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ color: 'white', fontFamily: 'Playfair Display' }}>
        Defrag Video (Scaffold)
      </h1>
      <p style={{ color: 'white' }}>Seed: {seed}</p>
      <p style={{ color: 'white' }}>Friction: {friction}</p>
      <p style={{ color: 'white' }}>Pressure: {pressure}</p>
    </AbsoluteFill>
  );
};
