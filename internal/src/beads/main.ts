import { loop } from "./loop.ts";

if (process.env["NODE_ENV"] !== "test") {
  loop();
}
