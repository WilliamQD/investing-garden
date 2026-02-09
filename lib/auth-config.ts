import type { NextAuthOptions } from 'next-auth';
import Auth0Provider from 'next-auth/providers/auth0';

type Role = 'admin' | 'editor' | 'viewer';

const OIDC_SESSION_TTL_SECONDS = 60 * 60 * 12;

const parseRoleList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map(role => role.trim())
    .filter(Boolean);

const adminRoles = parseRoleList(process.env.OIDC_ADMIN_ROLES);
const editorRoles = parseRoleList(process.env.OIDC_EDITOR_ROLES);
if (adminRoles.length === 0) {
  adminRoles.push('admin');
}
if (editorRoles.length === 0) {
  editorRoles.push('editor');
}

const roleClaim = process.env.OIDC_ROLE_CLAIM || 'roles';

const extractRoles = (profile: Record<string, unknown>) => {
  const raw = profile[roleClaim];
  if (Array.isArray(raw)) {
    return raw.map(value => String(value));
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(value => value.trim());
  }
  return [];
};

export const resolveOidcRole = (profile: Record<string, unknown>): Role => {
  const roles = extractRoles(profile);
  if (roles.some(role => adminRoles.includes(role))) {
    return 'admin';
  }
  if (roles.some(role => editorRoles.includes(role))) {
    return 'editor';
  }
  return 'viewer';
};

const issuer = process.env.OIDC_ISSUER ?? '';
const clientId = process.env.OIDC_CLIENT_ID ?? '';
const clientSecret = process.env.OIDC_CLIENT_SECRET ?? '';
const authSecret = process.env.NEXTAUTH_SECRET ?? '';

export const isOidcConfigured = Boolean(issuer && clientId && clientSecret && authSecret);

export const authOptions: NextAuthOptions = {
  secret: authSecret || undefined,
  providers: isOidcConfigured
    ? [
        Auth0Provider({
          clientId,
          clientSecret,
          issuer,
          authorization: { params: { scope: 'openid profile email' } },
          profile(profile: Record<string, unknown>) {
            return {
              id:
                String(
                  profile.sub ??
                    profile.id ??
                    profile.user_id ??
                    profile.uid ??
                    profile.email ??
                    'oidc-user'
                ),
              name:
                String(
                  profile.name ??
                    profile.preferred_username ??
                    profile.email ??
                    'OIDC User'
                ),
              email: typeof profile.email === 'string' ? profile.email : undefined,
              role: resolveOidcRole(profile),
            } as {
              id: string;
              name?: string;
              email?: string;
              role: Role;
            };
          },
        }),
      ]
    : [],
  session: {
    strategy: 'jwt',
    maxAge: OIDC_SESSION_TTL_SECONDS,
    updateAge: 60 * 30,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && typeof user === 'object' && 'role' in user) {
        token.role = (user as { role?: Role }).role ?? 'viewer';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & { role?: string };
        sessionUser.role = typeof token.role === 'string' ? token.role : 'viewer';
      }
      return session;
    },
  },
};
