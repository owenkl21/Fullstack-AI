import crypto from 'node:crypto';
import axios from 'axios';
import { prisma } from './prisma';

/*
 * Where the fish namer is.
 *
 * The namer runs on the hub, Owen's own PC, behind a Cloudflare quick tunnel.
 * A quick tunnel is given a new random *.trycloudflare.com name every time it
 * starts, so an address written into Railway by hand went dead at the first
 * restart and the namer failed quietly until somebody noticed.
 *
 * So the hub says where it is. A timer on the hub posts its current address
 * here every minute, signed with the token the two already share; the address
 * is kept in the database and used ahead of FISHIAL_URL, which stays as the
 * fallback. A restart is mended within a minute with nobody touching anything.
 *
 * An address is taken only if it is an https quick tunnel (or the host
 * FISHIAL_URL already names), and only once the hub answers there with the
 * shared token: a stranger cannot point the server's photographs at a host of
 * their own without the token, and a typo cannot break the namer.
 */

const SETTING = 'fishial-url';

/* Undefined until read; null when nothing has been announced. */
let announced: string | null | undefined;

const token = () => (process.env.FISHIAL_TOKEN ?? '').trim();

/** The namer's address: the one the hub last announced, else FISHIAL_URL. */
export async function hubUrl(): Promise<string | null> {
   if (announced === undefined) {
      try {
         const row = await prisma.serverSetting.findUnique({
            where: { key: SETTING },
            select: { value: true },
         });
         announced = row?.value ?? null;
      } catch {
         /* Read again next time; the fallback stands meanwhile. */
         return (process.env.FISHIAL_URL ?? '').trim() || null;
      }
   }
   return announced ?? ((process.env.FISHIAL_URL ?? '').trim() || null);
}

/** Whether a request carries the hub's token. Compared in constant time. */
export function isHubToken(header: string | undefined): boolean {
   const expected = token();
   if (!expected || !header) return false;
   const given = Buffer.from(header);
   const wanted = Buffer.from(`Bearer ${expected}`);
   return (
      given.length === wanted.length && crypto.timingSafeEqual(given, wanted)
   );
}

/* An https quick tunnel, or the host FISHIAL_URL already names (a named
   tunnel, if there is ever one). Nothing else, and no path. */
export function normaliseHubAddress(raw: unknown): string | null {
   if (typeof raw !== 'string' || raw.length > 200) return null;
   let url: URL;
   try {
      url = new URL(raw.trim());
   } catch {
      return null;
   }
   if (url.protocol !== 'https:' || url.username || url.password) return null;
   if (url.port) return null;
   const host = url.hostname.toLowerCase();
   let known: string | null = null;
   try {
      known = process.env.FISHIAL_URL
         ? new URL(process.env.FISHIAL_URL).hostname.toLowerCase()
         : null;
   } catch {
      known = null;
   }
   const quickTunnel = /^[a-z0-9-]+\.trycloudflare\.com$/.test(host);
   if (!quickTunnel && host !== known) return null;
   return `https://${host}`;
}

/**
 * Take the hub's announcement. `same` costs nothing; a new address is kept
 * only once the hub answers at it with the shared token.
 */
export async function announceHub(
   raw: unknown
): Promise<'saved' | 'same' | 'refused' | 'unreachable'> {
   const address = normaliseHubAddress(raw);
   if (!address) return 'refused';
   if (address === (await hubUrl())) return 'same';

   try {
      const answer = await axios.get(`${address}/health`, {
         timeout: 8000,
         headers: { Authorization: `Bearer ${token()}` },
         validateStatus: () => true,
         maxRedirects: 0,
      });
      if (answer.status !== 200) return 'unreachable';
   } catch {
      return 'unreachable';
   }

   await prisma.serverSetting.upsert({
      where: { key: SETTING },
      update: { value: address },
      create: { key: SETTING, value: address },
   });
   announced = address;
   console.info('[hub] the fish namer is now at', address);
   return 'saved';
}
