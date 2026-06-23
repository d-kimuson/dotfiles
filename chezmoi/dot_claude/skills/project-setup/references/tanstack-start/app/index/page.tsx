import { createFileRoute } from '@tanstack/react-router';
import { type FC, useEffect } from 'react';

const IndexRoute: FC = () => {
  const navigate = Route.useNavigate();

  useEffect(() => {
    void navigate({ to: '/home', replace: true });
  }, [navigate]);

  return null;
};

export const Route = createFileRoute('/')({
  component: IndexRoute,
});
