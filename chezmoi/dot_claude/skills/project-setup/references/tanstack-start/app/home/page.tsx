import { createFileRoute } from '@tanstack/react-router';
import { type FC } from 'react';

const HomePage: FC = () => {
  return (
    <main>
      <h1>{'<site-name>'}</h1>
    </main>
  );
};

export const Route = createFileRoute('/home')({
  component: HomePage,
});
