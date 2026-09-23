# Security and privacy

## Authentication and authorization

Use Supabase Auth. Store refresh/session credentials only in Expo SecureStore. Enable RLS on every public financial table; policies use `auth.uid() = user_id`. Financial writes occur through `security definer` RPCs that verify owner, rules, and correction window. The client uses the anonymous key only; never ship a service-role key.

## Device re-entry lock

When the app returns to foreground after the chosen grace interval, obscure sensitive UI immediately and require app PIN or biometrics via Expo LocalAuthentication. Keep a PIN verifier/salt in SecureStore, never plain text. Biometric enrollment changes, lockout, and unsupported devices need a PIN fallback. This is an app privacy lock, not a replacement for Supabase authentication.

## Storage and data minimization

Receipt bucket is private. Path must start with `user_id/`; Storage policy checks this prefix. Generate short-lived signed URLs only when viewing a receipt. Compress images, remove location EXIF, cap dimensions/file size, and validate MIME type server-side. Avoid receipt content OCR in MVP.

## Defensive practices

- Validate data with Zod at input and DTO boundaries; parameterize local queries.
- Redact PII/amounts/notes/tokens from logs, analytics, crash reports, and test fixtures.
- Use HTTPS (Supabase default), least privilege, dependency updates, and secret scanning.
- Explain export sensitivity, write to a user-chosen location/share sheet, and clean temporary files.
- Test RLS with a second account on every schema change.

