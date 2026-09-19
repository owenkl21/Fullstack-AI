import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

/*
 * Two eyes on a photograph.
 *
 * The measurement reader: a fish on a tape or a scale, and Claude reads the
 * figure off the picture so a competition entry is what the picture says,
 * not what the angler typed. Haiku is the model on purpose: this is a read,
 * not a judgement, it costs a few tenths of a cent a photograph, and a
 * competition can put a hundred photographs through it on a Saturday.
 *
 * The species namer: Fishial's open model, running on Owen's own machine,
 * reached through a URL the server is told about. It names the fish; the
 * angler confirms. Nothing here is stored except what the angler accepts.
 */

const MODEL = 'claude-haiku-4-5';

let client: Anthropic | null = null;
const anthropic = () => {
   if (!process.env.ANTHROPIC_API_KEY) return null;
   client ??= new Anthropic();
   return client;
};

export type MeasureRead = {
   value: number | null;
   unit: 'cm' | 'in' | 'kg' | 'lb' | null;
   /* 0 to 1. Under about 0.6 the angler is asked to retake. */
   confidence: number;
   note: string;
   /* What the reader could see: a tape, a scale, neither. */
   seen: 'tape' | 'scale' | 'none';
};

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const mediaTypeOf = (contentType: string | undefined): MediaType =>
   contentType === 'image/png'
      ? 'image/png'
      : contentType === 'image/webp'
        ? 'image/webp'
        : contentType === 'image/gif'
          ? 'image/gif'
          : 'image/jpeg';

async function fetchImage(url: string) {
   const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 12 * 1024 * 1024,
   });
   return {
      data: Buffer.from(response.data).toString('base64'),
      mediaType: mediaTypeOf(response.headers['content-type']),
   };
}

export const visionService = {
   available: () => Boolean(process.env.ANTHROPIC_API_KEY),

   /**
    * Read a length or a weight off a photograph. Returns null when there is
    * no key, so the caller can say the feature is off rather than broken.
    */
   async readMeasure(
      imageUrl: string,
      measure: 'LENGTH' | 'WEIGHT'
   ): Promise<MeasureRead | null> {
      const api = anthropic();
      if (!api) return null;

      const image = await fetchImage(imageUrl);
      const want =
         measure === 'LENGTH'
            ? 'the length of the fish as shown on the measuring tape or ruler, in the unit printed on it'
            : 'the weight shown on the scale the fish is hanging from or lying on, in the unit the scale shows';

      const response = await api.messages.create({
         model: MODEL,
         max_tokens: 1024,
         system:
            'You read measurements off photographs of fish for a fishing competition. ' +
            'You are strict: you report only a figure you can actually read from the tape, ruler or scale in the picture, ' +
            'you never estimate from the fish itself, and if the figure is not clearly readable you say so with low confidence. ' +
            "Read the number at the fish's nose or tail on a tape, or the display on a scale.",
         tools: [
            {
               name: 'report_reading',
               description: 'Report the measurement read from the photograph.',
               strict: true,
               input_schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                     value: {
                        type: ['number', 'null'],
                        description:
                           'The figure read, or null if it cannot be read.',
                     },
                     unit: {
                        type: ['string', 'null'],
                        enum: ['cm', 'in', 'kg', 'lb', null],
                        description: 'The unit printed on the tape or scale.',
                     },
                     confidence: {
                        type: 'number',
                        description: 'How sure you are, 0 to 1.',
                     },
                     seen: {
                        type: 'string',
                        enum: ['tape', 'scale', 'none'],
                        description: 'What measuring device is visible.',
                     },
                     note: {
                        type: 'string',
                        description:
                           'One short sentence: what you read and from where, or why you could not.',
                     },
                  },
                  required: ['value', 'unit', 'confidence', 'seen', 'note'],
               },
            },
         ],
         tool_choice: { type: 'tool', name: 'report_reading' },
         messages: [
            {
               role: 'user',
               content: [
                  {
                     type: 'image',
                     source: {
                        type: 'base64',
                        media_type: image.mediaType,
                        data: image.data,
                     },
                  },
                  {
                     type: 'text',
                     text: `Read ${want}. If the fish is not against a tape, ruler or scale, or the figure is hidden or blurred, report null with low confidence.`,
                  },
               ],
            },
         ],
      });

      const call = response.content.find((block) => block.type === 'tool_use');
      if (!call || call.type !== 'tool_use') {
         return {
            value: null,
            unit: null,
            confidence: 0,
            seen: 'none',
            note: 'The picture could not be read.',
         };
      }
      const input = call.input as Partial<MeasureRead>;
      return {
         value: typeof input.value === 'number' ? input.value : null,
         unit: input.unit ?? null,
         confidence:
            typeof input.confidence === 'number'
               ? Math.max(0, Math.min(1, input.confidence))
               : 0,
         seen: input.seen ?? 'none',
         note: String(input.note ?? '').slice(0, 280),
      };
   },

   /**
    * Ask the fish namer on the hub for its best guesses. The hub answers
    * with names and confidences; matching them to our species table is the
    * caller's job, because only the caller knows the table.
    */
   async identify(
      imageUrl: string
   ): Promise<
      { name: string; commonName: string | null; confidence: number }[] | null
   > {
      const base = process.env.FISHIAL_URL;
      if (!base) return null;
      const image = await fetchImage(imageUrl);
      const response = await axios.post<{
         candidates?: {
            name: string;
            commonName?: string | null;
            confidence: number;
         }[];
      }>(
         `${base.replace(/\/$/, '')}/identify`,
         { image: image.data, mediaType: image.mediaType },
         {
            timeout: 20000,
            headers: process.env.FISHIAL_TOKEN
               ? { Authorization: `Bearer ${process.env.FISHIAL_TOKEN}` }
               : {},
         }
      );
      return (response.data.candidates ?? [])
         .filter((c) => c && typeof c.name === 'string')
         .map((c) => ({
            name: c.name,
            commonName:
               typeof c.commonName === 'string' && c.commonName.trim()
                  ? c.commonName.trim()
                  : null,
            confidence: typeof c.confidence === 'number' ? c.confidence : 0,
         }))
         .sort((a, b) => b.confidence - a.confidence)
         .slice(0, 5);
   },
};
