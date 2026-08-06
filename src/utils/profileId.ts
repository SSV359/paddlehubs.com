/**
 * navigateTo('profile', id) only carries a single string. Previously
 * that string was "email if we have one, else name" — which meant the
 * name got silently dropped whenever an email was available, even
 * though most call sites actually know BOTH at the point of
 * navigation. That mattered because the Profile page's account lookup
 * by email can fail (e.g., a player's account was created before email
 * tracking existed) — and without a name to fall back to, it had
 * nothing left to try, even in cases where a simple name-based match
 * would have worked immediately.
 *
 * This packs both pieces of identity into one string so Profile always
 * has both to work with, while staying backward compatible with any
 * caller that still only passes a single plain email or name.
 */
const DELIM = '\u241F'; // a control-picture character that will never appear in a real name/email

export function encodeProfileId(email?: string | null, name?: string | null): string {
  const e = (email || '').trim();
  const n = (name || '').trim();
  if (e && n) return `${e}${DELIM}${n}`;
  return e || n || '';
}

export function decodeProfileId(id: string | null | undefined): { email?: string; name?: string } {
  if (!id) return {};
  if (id.includes(DELIM)) {
    const [email, name] = id.split(DELIM);
    return { email: email || undefined, name: name || undefined };
  }
  // Backward compatible: a single value with no delimiter — guess
  // email vs name the same way the app already did.
  return id.includes('@') ? { email: id } : { name: id };
}
