import { Composition } from 'remotion';
import { Video } from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DefragVideo"
        component={Video}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          seed: 'default-seed',
          friction: 0.5,
          pressure: 0.5,
        }}
      />
    </>
  );
};
