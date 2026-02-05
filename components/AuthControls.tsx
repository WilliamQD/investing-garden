'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

export default function AuthControls() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  return (
    <div className="auth-controls">
      {session?.user ? (
        <>
          <span className="auth-status">Signed in as {session.user.name ?? session.user.email}</span>
          <button className="auth-button" onClick={() => signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <span className="auth-status">
            {isLoading ? 'Checking session...' : 'Read-only mode'}
          </span>
          <button className="auth-button" onClick={() => signIn()}>
            Sign in
          </button>
        </>
      )}
    </div>
  );
}
