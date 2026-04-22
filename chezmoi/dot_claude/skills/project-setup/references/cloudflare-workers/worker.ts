import { honoApp } from './hono/app.ts';
import { routes } from './hono/routes.ts';

const app = routes(honoApp());

export default {
  fetch(request, env, ...args) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ...args);
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
