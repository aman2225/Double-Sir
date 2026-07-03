import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { ensurePlayerProfileForUser } from "./playerProfile";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.avatarUrl ?? undefined };
      },
    }),
    // Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env — see
    // .env.example. Guest Mode and email/password login both work fine
    // without these being set; the Google button simply won't complete
    // sign-in until real credentials are supplied.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        const dbUser =
          existing ??
          (await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name ?? user.email,
              avatarUrl: user.image ?? undefined,
              googleId: account.providerAccountId,
            },
          }));

        if (existing && !existing.googleId) {
          await prisma.user.update({ where: { id: existing.id }, data: { googleId: account.providerAccountId } });
        }

        await ensurePlayerProfileForUser({ id: dbUser.id, name: dbUser.name, avatarUrl: dbUser.avatarUrl });
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        const profile = await ensurePlayerProfileForUser({
          id: user.id,
          name: user.name ?? "Player",
          avatarUrl: user.image,
        });
        token.playerProfileId = profile.id;
        token.name = user.name ?? token.name;
        token.picture = user.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string | undefined) ?? "";
        session.user.playerProfileId = (token.playerProfileId as string | undefined) ?? "";
      }
      return session;
    },
  },
});
