import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth's catch-all handler. Auth routes are rate-limited by NextAuth's own
// flow plus our `auth` tier is applied on any custom credential endpoints we
// add later; the built-in provider endpoints live here.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
