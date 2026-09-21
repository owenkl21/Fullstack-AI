/*
 * A photograph with its location taken out, for anything leaving this server.
 *
 * The original in the bucket keeps everything the camera wrote: it is the
 * angler's own file and the log reads its time and place. But a copy sent to
 * the species namer, the measurement reader or the namer's training gallery
 * has no need to know where the fish came out, and a private mark should not
 * travel to a machine that is not ours to keep.
 *
 * The GPS values are zeroed where they sit rather than the EXIF block being
 * dropped, the way Android redacts a photo it shares. Dropping the block would
 * also drop the orientation tag, and a phone photograph is usually stored on
 * its side with that tag saying which way is up; the namer would then be
 * shown a fish lying on its back. XMP is dropped whole: it is an editor's
 * copy of the same tags, it can carry the position again as text, and nothing
 * downstream reads it.
 *
 * JPEG only, because that is what phones write and what the pickers take. A
 * file that cannot be walked loses its EXIF block entirely: when in doubt, the
 * location does not leave.
 */

const EXIF_HEADER = Buffer.from('Exif\0\0', 'latin1');
const XMP_PREFIXES = [
   'http://ns.adobe.com/xap/1.0/',
   'http://ns.adobe.com/xmp/extension/',
];
const TAG_GPS_IFD = 0x8825;

/* Bytes per value for each TIFF type; unknown types are treated as bytes. */
const TYPE_SIZE: Record<number, number> = {
   1: 1,
   2: 1,
   3: 2,
   4: 4,
   5: 8,
   6: 1,
   7: 1,
   8: 2,
   9: 4,
   10: 8,
   11: 4,
   12: 8,
};

const isJpeg = (buf: Buffer) =>
   buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8;

/*
 * Zero every value in the GPS directory of one Exif segment, in a copy. Throws
 * on anything malformed, and the caller drops the segment instead.
 */
function zeroGps(segment: Buffer): Buffer {
   const out = Buffer.from(segment);
   const tiff = 4 + EXIF_HEADER.length;
   const little = out.readUInt16BE(tiff) === 0x4949;
   const u16 = (at: number) =>
      little ? out.readUInt16LE(at) : out.readUInt16BE(at);
   const u32 = (at: number) =>
      little ? out.readUInt32LE(at) : out.readUInt32BE(at);
   if (u16(tiff + 2) !== 42) throw new Error('not tiff');

   const ifd0 = tiff + u32(tiff + 4);
   const count0 = u16(ifd0);
   let gps: number | null = null;
   for (let i = 0; i < count0; i++) {
      const entry = ifd0 + 2 + i * 12;
      if (u16(entry) === TAG_GPS_IFD) gps = tiff + u32(entry + 8);
   }
   if (gps === null) return out;

   const count = u16(gps);
   for (let i = 0; i < count; i++) {
      const entry = gps + 2 + i * 12;
      const size = (TYPE_SIZE[u16(entry + 2)] ?? 1) * u32(entry + 4);
      if (size <= 4) {
         out.fill(0, entry + 8, entry + 12);
      } else {
         const at = tiff + u32(entry + 8);
         if (at + size > out.length) throw new Error('gps value out of range');
         out.fill(0, at, at + size);
      }
   }
   return out;
}

export function stripLocation(input: Buffer): Buffer {
   if (!isJpeg(input)) return input;

   const parts: Buffer[] = [input.subarray(0, 2)];
   let offset = 2;
   while (offset + 4 <= input.length) {
      if (input[offset] !== 0xff) break;
      const marker = input[offset + 1]!;
      if (marker === 0xff) {
         parts.push(input.subarray(offset, offset + 1));
         offset += 1;
         continue;
      }
      /* Start of the picture itself: everything after is image data. */
      if (marker === 0xda || marker === 0xd9) break;

      const end = offset + 2 + input.readUInt16BE(offset + 2);
      if (end > input.length) break;
      const segment = input.subarray(offset, end);

      if (marker === 0xe1) {
         const body = segment.subarray(4);
         if (body.subarray(0, EXIF_HEADER.length).equals(EXIF_HEADER)) {
            try {
               parts.push(zeroGps(segment));
            } catch {
               /* Could not be read, so it does not go. */
            }
            offset = end;
            continue;
         }
         const head = body.toString('latin1', 0, 40);
         if (XMP_PREFIXES.some((prefix) => head.startsWith(prefix))) {
            offset = end;
            continue;
         }
      }

      parts.push(segment);
      offset = end;
   }
   parts.push(input.subarray(offset));
   return Buffer.concat(parts);
}
