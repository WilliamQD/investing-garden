## 2024-05-22 - Plaintext Environment Variable Vulnerability
**Vulnerability:** Admin credentials were stored and compared in plaintext using environment variables.
**Learning:** Even though environment variables are server-side, they are often logged or exposed in process listings. Comparing plaintext passwords directly also risks timing attacks (though `timingSafeEqual` mitigates this).
**Prevention:** Always use a slow hashing algorithm like scrypt or Argon2 for password verification, even for internal credentials. Implemented `lib/password-utils.ts` to handle this with backward compatibility.
