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
 *
 * It reads the position in the same walk. There used to be a second reader
 * here that took the time and stepped over the GPS block beside it, and the
 * full catch form called that one, which is why a photograph that knew the
 * gully it came out of still left the map empty. One reader now, returning
 * both, so a form cannot ask for half of what the file is holding.
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

export type PhotoMeta = {
   takenAt: Date | null;
   latitude: number | null;
   longitude: number | null;
};

const NO_META: PhotoMeta = { takenAt: null, latitude: null, longitude: null };

/** When and where the camera says the photograph was taken. */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
   if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
      return NO_META;
   }
   const buffer = await file.slice(0, HEAD_BYTES).arrayBuffer();
   const view = new DataView(buffer);
   if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return NO_META;

   let offset = 2;
   while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return NO_META;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
         const start = offset + 4;
         if (
            start + 6 <= view.byteLength &&
            view.getUint32(start) === 0x45786966
         ) {
            return readTiffMeta(view, start + 6);
         }
      }
      if (marker === 0xda) return NO_META;
      offset += 2 + size;
   }
   return NO_META;
}

const TAG_GPS_IFD = 0x8825;
const GPS_LAT_REF = 0x0001;
const GPS_LAT = 0x0002;
const GPS_LNG_REF = 0x0003;
const GPS_LNG = 0x0004;

/*
 * The same walk as above, reading the date and the GPS block together. GPS
 * coordinates are three rationals (degrees, minutes, seconds) with a
 * hemisphere letter beside them.
 */
function readTiffMeta(view: DataView, tiff: number): PhotoMeta {
   if (tiff + 8 > view.byteLength) return NO_META;
   const little = view.getUint16(tiff) === 0x4949;
   const u16 = (at: number) => view.getUint16(at, little);
   const u32 = (at: number) => view.getUint32(at, little);
   if (u16(tiff + 2) !== 42) return NO_META;

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

   const rationals = (at: number, count: number) => {
      const out: number[] = [];
      for (let i = 0; i < count; i++) {
         const n = u32(at + i * 8);
         const d = u32(at + i * 8 + 4);
         out.push(d ? n / d : 0);
      }
      return out;
   };

   type Entry = { tag: number; type: number; count: number; at: number };
   const entries = (ifd: number): Entry[] => {
      const out: Entry[] = [];
      if (ifd + 2 > view.byteLength) return out;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
         const at = ifd + 2 + i * 12;
         if (at + 12 > view.byteLength) break;
         out.push({ tag: u16(at), type: u16(at + 2), count: u32(at + 4), at });
      }
      return out;
   };
   const valueAt = (e: Entry, size: number) =>
      e.count * size > 4 ? tiff + u32(e.at + 8) : e.at + 8;

   const ifd0 = entries(tiff + u32(tiff + 4));
   let original: string | null = null;
   let plain: string | null = null;
   let exifIfd: number | null = null;
   let gpsIfd: number | null = null;
   for (const e of ifd0) {
      if (e.tag === TAG_EXIF_IFD) exifIfd = tiff + u32(e.at + 8);
      else if (e.tag === TAG_GPS_IFD) gpsIfd = tiff + u32(e.at + 8);
      else if (e.tag === TAG_DATE_TIME && e.type === 2)
         plain = ascii(valueAt(e, 1), e.count);
   }
   if (exifIfd !== null) {
      for (const e of entries(exifIfd)) {
         if (e.tag === TAG_DATE_TIME_ORIGINAL && e.type === 2)
            original = ascii(valueAt(e, 1), e.count);
      }
   }

   let latitude: number | null = null;
   let longitude: number | null = null;
   if (gpsIfd !== null) {
      let latRef = 'N';
      let lngRef = 'E';
      let lat: number[] | null = null;
      let lng: number[] | null = null;
      for (const e of entries(gpsIfd)) {
         if (e.tag === GPS_LAT_REF) latRef = ascii(e.at + 8, 2);
         else if (e.tag === GPS_LNG_REF) lngRef = ascii(e.at + 8, 2);
         else if (e.tag === GPS_LAT && e.type === 5 && e.count === 3)
            lat = rationals(valueAt(e, 8), 3);
         else if (e.tag === GPS_LNG && e.type === 5 && e.count === 3)
            lng = rationals(valueAt(e, 8), 3);
      }
      const toDeg = (p: number[]) => p[0]! + p[1]! / 60 + p[2]! / 3600;
      if (lat && lng) {
         const la = toDeg(lat) * (latRef.startsWith('S') ? -1 : 1);
         const ln = toDeg(lng) * (lngRef.startsWith('W') ? -1 : 1);
         /* A camera with no fix writes zeros; that is not a place. */
         if (
            Number.isFinite(la) &&
            Number.isFinite(ln) &&
            (la !== 0 || ln !== 0)
         ) {
            latitude = la;
            longitude = ln;
         }
      }
   }

   const text = original ?? plain;
   return { takenAt: text ? parseExifDate(text) : null, latitude, longitude };
}
