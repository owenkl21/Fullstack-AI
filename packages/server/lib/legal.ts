/*
 * The version of the Terms and Privacy Policy a new account agrees to.
 *
 * The words live in the client (src/pages/legal/legal-content.ts), which
 * sends this same date with a sign-up. The two must move together: when the
 * words change, both dates change in the same commit, and a sign-up carrying
 * the old date is refused until the page is reloaded and the new words seen.
 */
export const LEGAL_VERSION = '2026-09-21';
