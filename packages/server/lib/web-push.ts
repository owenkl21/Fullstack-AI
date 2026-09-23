import crypto from 'node:crypto';
import webpush from 'web-push';

/*
 * Web Push, the whole of it: one encrypted POST to the address a browser
 * handed over when it subscribed.
 *
 * The sealing (RFC 8291) and the signed token that names this server to the
 * push service (RFC 8292) come from the web-push package, which every browser
 * vendor tests against. The POST itself is made here with fetch rather than
 * with the package's own sender, for two reasons: a bounded timeout and no
 * redirects, so a push service can neither hold a request open nor send this
 * server somewhere else; and so that off a deploy a stand-in push service on
 * a plain http address can take the message, which the package refuses.
 *
 * Nothing here touches the database or knows what a notification is;
 * services/push.service.ts does that.
 */

export type VapidKeys = {
   /** The uncompressed P-256 point, 65 bytes, base64url. Browsers subscribe with it. */
   publicKey: string;
   /** The 32 byte scalar, base64url. Never leaves the server. */
   privateKey: string;
};

export type PushTarget = {
   endpoint: string;
   p256dh: string;
   auth: string;
};

export type PushResult = {
   ok: boolean;
   status: number;
   /** The push service says this browser is gone for good: drop the row. */
   gone: boolean;
};

const fromB64u = (value: string) => Buffer.from(value, 'base64url');

/* A day. Long enough for a phone in a drawer overnight, short enough that a
 * like from last week does not arrive as news. */
const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;

export function generateVapidKeys(): VapidKeys {
   const made = webpush.generateVAPIDKeys();
   return { publicKey: made.publicKey, privateKey: made.privateKey };
}

/** True for a pair that really is a P-256 key and its own public point. */
export function isVapidPair(keys: VapidKeys) {
   try {
      const priv = fromB64u(keys.privateKey);
      const pub = fromB64u(keys.publicKey);
      if (priv.length !== 32 || pub.length !== 65 || pub[0] !== 4) return false;
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(priv);
      return ecdh.getPublicKey().equals(pub);
   } catch {
      return false;
   }
}

/*
 * A Topic lets the push service swap a message it is still holding for a
 * newer one about the same thing, so a phone that was off for the afternoon
 * wakes to one line per post and not twenty. At most 32 characters from the
 * base64url alphabet, which a hash gives for any tag.
 */
const topicOf = (tag: string) =>
   crypto.createHash('sha256').update(tag).digest('base64url').slice(0, 32);

export async function sendWebPush(
   target: PushTarget,
   payload: string,
   options: { keys: VapidKeys; subject: string; tag?: string }
): Promise<PushResult> {
   const request = webpush.generateRequestDetails(
      {
         endpoint: target.endpoint,
         keys: { p256dh: target.p256dh, auth: target.auth },
      },
      payload,
      {
         vapidDetails: {
            subject: options.subject,
            publicKey: options.keys.publicKey,
            privateKey: options.keys.privateKey,
         },
         contentEncoding: 'aes128gcm',
         TTL: TTL_SECONDS,
         urgency: 'normal',
         ...(options.tag ? { topic: topicOf(options.tag) } : {}),
      }
   );

   /* Content-Length is fetch's to set; a copy of it here is refused. */
   const headers: Record<string, string> = {};
   for (const [name, value] of Object.entries(request.headers)) {
      if (name.toLowerCase() !== 'content-length')
         headers[name] = String(value);
   }

   const response = await fetch(request.endpoint, {
      method: request.method,
      headers,
      body: request.body ? new Uint8Array(request.body) : undefined,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      /* A push service has no business sending this server anywhere else. */
      redirect: 'error',
   });
   /* Nothing in the answer is wanted; reading it lets the socket go. */
   await response.arrayBuffer().catch(() => undefined);
   return {
      ok: response.ok,
      status: response.status,
      gone: response.status === 404 || response.status === 410,
   };
}
