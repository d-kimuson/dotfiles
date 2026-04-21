import { startServer } from "./hono/server";

await startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
