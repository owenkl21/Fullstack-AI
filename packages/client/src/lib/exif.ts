/*
 * When a photograph was taken, read from the file itself.
 *
 * A phone writes the moment of the shutter into the JPEG as EXIF
 * DateTimeOriginal, in the camera's own local time. For a log of several
 * fish that is the honest record of when each one came out, and it is
 * already in the picker's hands before anything is uploaded. Only the first
 * 128 KB is read: the EXIF block sits at the front of the file.
 *
 * Hand rolled rather than a dependency because the picker only takes JPEG,
 * PNG and WebP, and only JPEG carries this, so the whole parser is one
 * segment walk and one directory walk.
 */

const HEAD_BYTES = 128 * 1024;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME = 0x0132;

/** "2026:09:15 06:42:10" as a Date in the reader's zone, or null. */
const parseExifDate = (text: string): Date | null => {
   const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text);
   if (!m) return null;
   const [, y, mo, d, h, mi, s] = m;
   const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
   );
   return Number.isNaN(date.getTime()) || Number(y) < 1990 ? null : date;
};

export async function readTakenAt(file: File): Promise<Date | null> {
   if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
      return null;
   }

   const buffer = await file.slice(0, HEAD_BYTES).arrayBuffer();
   const view = new DataView(buffer);
   if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

   /* Walk the JPEG segments to APP1 with the Exif header. */
   let offset = 2;
   while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
         const start = offset + 4;
         if (
            start + 6 <= view.byteLength &&
            view.getUint32(start) === 0x45786966 /* "Exif" */
         ) {
            return readTiff(view, start + 6);
         }
      }
      /* Image data starts here; nothing after it is EXIF. */
      if (marker === 0xda) return null;
      offset += 2 + size;
   }
   return null;
}

function readTiff(view: DataView, tiff: number): Date | null {
   if (tiff + 8 > view.byteLength) return null;
   const little = view.getUint16(tiff) === 0x4949;
   const u16 = (at: number) => view.getUint16(at, little);
   const u32 = (at: number) => view.getUint32(at, little);
   if (u16(tiff + 2) !== 42) return null;

   const ascii = (at: number, count: number) => {
      const end = Math.min(at + count, view.byteLength);
      let out = '';
      for (let i = at; i < end; i++) {
         const c = view.getUint8(i);
         if (c === 0) break;
         out += String.fromCharCode(c);
      }
      return out;
   };

   /* Reads one directory; returns the wanted tags and the Exif sub-IFD. */
   const walk = (ifd: number) => {
      const found: { original?: string; plain?: string; exifIfd?: number } = {};
      if (ifd + 2 > view.byteLength) return found;
      const entries = u16(ifd);
      for (let i = 0; i < entries; i++) {
         const at = ifd + 2 + i * 12;
         if (at + 12 > view.byteLength) break;
         const tag = u16(at);
         const type = u16(at + 2);
         const count = u32(at + 4);
         if (tag === TAG_EXIF_IFD) {
            found.exifIfd = tiff + u32(at + 8);
         } else if (
            (tag === TAG_DATE_TIME_ORIGINAL || tag === TAG_DATE_TIME) &&
            type === 2
         ) {
            /* Values over four bytes live at an offset; a date is twenty. */
            const where = count > 4 ? tiff + u32(at + 8) : at + 8;
            const text = ascii(where, count);
            if (tag === TAG_DATE_TIME_ORIGINAL) found.original = text;
            else found.plain = text;
         }
      }
      return found;
   };

   const ifd0 = walk(tiff + u32(tiff + 4));
   const exif = ifd0.exifIfd !== undefined ? walk(ifd0.exifIfd) : {};
   const text = exif.original ?? ifd0.original ?? ifd0.plain ?? null;
   return text ? parseExifDate(text) : null;
}
