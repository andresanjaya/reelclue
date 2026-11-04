import "server-only";
import { parseEnv } from "../env";

export const env = parseEnv(process.env);
