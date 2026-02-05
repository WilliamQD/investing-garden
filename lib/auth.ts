import 'server-only';

import { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';

const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
const adminUsername = process.env.ADMIN_GITHUB_USERNAME?.toLowerCase();

export const isAuthorizedUser = (
  user?: { email?: string | null; name?: string | null },
  profile?: { login?: string | null }
) => {
  if (!user) return false;
  if (adminEmail && user.email?.toLowerCase() !== adminEmail) return false;
  if (adminUsername) {
    const login = profile?.login?.toLowerCase();
    const name = user.name?.toLowerCase();
    if (login !== adminUsername && name !== adminUsername) {
      return false;
    }
  }
  return true;
};

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: credentials => {
        const username = process.env.CREDENTIALS_USERNAME;
        const password = process.env.CREDENTIALS_PASSWORD;
        if (!username || !password) return null;
        if (
          credentials?.username !== username ||
          credentials?.password !== password
        ) {
          return null;
        }
        const email = adminEmail || `${username}@local`;
        return { id: 'credentials', name: username, email };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      return isAuthorizedUser(user, profile as { login?: string } | undefined);
    },
    async jwt({ token, profile }) {
      if (profile && 'login' in profile) {
        token.login = profile.login as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.login) {
        session.user.name = token.login as string;
      }
      return session;
    },
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

export const getAuthorizedSession = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAuthorizedUser(session.user)) {
    return null;
  }
  return session;
};
