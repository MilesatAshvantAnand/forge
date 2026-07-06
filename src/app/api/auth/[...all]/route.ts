import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
// toNextJsHandler is the Next.js integration helper from better-auth

export const dynamic = "force-dynamic";

const { GET, POST } = toNextJsHandler(auth.handler);
export { GET, POST };
