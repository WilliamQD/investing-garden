const aliasEnv = (target: string, source: string) => {
  if (!process.env[target] && process.env[source]) {
    process.env[target] = process.env[source];
  }
};

aliasEnv('POSTGRES_URL', 'IG_POSTGRES_URL');
aliasEnv('ADMIN_USERNAME', 'IG_ADMIN_USERNAME');
aliasEnv('ADMIN_PASSWORD', 'IG_ADMIN_PASSWORD');
aliasEnv('ADMIN_SESSION_SECRET', 'IG_ADMIN_SESSION_SECRET');
aliasEnv('TWELVE_DATA_API_KEY', 'IG_TWELVE_DATA_API_KEY');
