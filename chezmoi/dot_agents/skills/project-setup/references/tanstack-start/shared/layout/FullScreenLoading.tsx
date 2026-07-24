import { type FC } from 'react';

export const FullScreenLoading: FC = () => {
  return (
    <div aria-label="読み込み中" role="status">
      Loading...
    </div>
  );
};
