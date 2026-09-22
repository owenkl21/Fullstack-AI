import Anthropic from '@anthropic-ai/sdk';
import z from 'zod';
import rubric from '../prompts/competition-judge.txt';
import readingRules from '../prompts/measure-reading.txt';
import type {
   AllowedSpecies,
   CheckCode,
   ReportLine,
} from './competition-entries.service';

/*
 * The judge: one look at a competition entry by Claude Sonnet 5.
 *
 * The six checks in competition-entries.service each ask one machine one
 * question. The judge is shown both photographs at once, with the rules and
 * the claim, and asked what a steward at a weigh in would ask: is that a fish,
 * is it the fish they say, does the tape say what they typed, is it the same
 * fish on the tape as in the picture, and does anything look made up.
 *
 * Three rules hold it in its place.
 * - It never has the last word on a rejection. Whatever it thinks is wrong
 *   sends the entry to the organiser, through the HELD state the checks
 *   already use. It can hold an entry; it cannot count one that the checks
 *   would have held.
 * - It fails soft. No key, no answer inside 20 seconds, or an answer that does
 *   not fit the schema, and the entry goes on exactly as it did before the
 *   judge existed, marked as not seen by it.
 * - Photographs reach it only through the loader it is handed, which is the
 *   vision service's, which takes the location out of every file first.
 *
 * The prompt is in two parts on purpose. The rubric and the reading rules
 * never change between entries, so they sit in the system prompt behind a
 * cache marker and a busy Saturday pays for them once every few minutes
 * rather than once an entry. Everything about this entry goes in the user
 * turn, after the marker. Both texts live in prompts/, and the reading rules
 * are shared with the measurement reader in vision.service, so there is one
 * description of how to read a tape to keep right.
 */

export const JUDGE_MODEL = 'claude-sonnet-5';
export const JUDGE_TIMEOUT_MS = 20_000;
const JUDGE_TOOL = 'judge_entry';

/* The reading rules, for the single photograph reader in vision.service. */
export const MEASURE_READING_RULES = readingRules.trim();

const JUDGE_SYSTEM = `${rubric.trim()}\n\n${MEASURE_READING_RULES}`;

export type JudgeCheckCode = CheckCode;
const CHECK_CODES = [
   'fish',
   'species',
   'figure',
   'window',
   'area',
   'duplicate',
] as const satisfies readonly CheckCode[];

export type ImageForModel = {
   data: string;
   mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
};

/* What the judge is told about the competition. */
export type JudgeCompetition = {
   name: string;
   blurb: string | null;
   rule: 'SPECIES_POINTS' | 'BIGGEST_FISH' | 'SPECIES_VARIETY';
   measure: 'LENGTH' | 'WEIGHT';
   checks: 'CASUAL' | 'REVIEW';
   /* Empty is any species. */
   species: AllowedSpecies[];
   startsAt: Date;
   endsAt: Date;
   timeZoneId: string;
   maxPerSpeciesPerDay: number;
   areaType: 'ANYWHERE' | 'WATERBODY' | 'REGION';
   areaName: string | null;
   areaRadiusKm: number | null;
};

/* What the judge is told about the entry. Figures are metric. */
export type JudgeEntry = {
   speciesName: string | null;
   declaredValue: number | null;
   caughtAt: Date;
   /* What the camera wrote in each photograph, when it wrote anything. */
   photoTakenAt: Date | null;
   measureTakenAt: Date | null;
   submittedAt: Date;
   /* The checks that ran before the judge: the position check and the
      duplicate fingerprint are the two it cannot see for itself. */
   report: ReportLine[];
};

export type JudgeInput = {
   competition: JudgeCompetition;
   entry: JudgeEntry;
   /* Where the two photographs are. The loader turns these into bytes. */
   photos: { fish: string | null; measure: string | null };
};

/* ---- The answer ------------------------------------------------------- */

const Verdict = z.enum(['pass', 'fail', 'unsure']);
const YesNo = z.enum(['yes', 'no', 'unsure']);
/* Trimmed and cut to length rather than refused: a reason that runs long
   is still a reason, and the page has only so much room for it. */
const text = (max: number) =>
   z.string().transform((value) => tidy(value).slice(0, max));

const verdictSchema = z.object({
   checks: z
      .array(
         z.object({
            check: z.enum(CHECK_CODES),
            verdict: Verdict,
            reason: text(280),
         })
      )
      .min(1)
      .max(12),
   measure: z.object({
      value: z.number().finite().positive().max(100000).nullable(),
      unit: z.enum(['cm', 'in', 'kg', 'lb']).nullable(),
      confidence: z
         .number()
         .finite()
         .transform((c) => Math.max(0, Math.min(1, c))),
      seen: z.enum(['tape', 'board', 'scale', 'none']),
   }),
   fishVisibleOnMeasure: YesNo,
   sameFishInBothPhotos: YesNo,
   species: z.object({
      plausible: YesNo,
      bestGuess: z
         .string()
         .nullable()
         .transform((value) =>
            value && tidy(value) ? tidy(value).slice(0, 120) : null
         ),
   }),
   tamperSigns: z
      .array(
         z.object({
            kind: z.enum(['screen', 'edited_digits', 'lighting', 'other']),
            detail: text(200),
         })
      )
      .max(8),
   overall: z.enum(['accept', 'review', 'reject']),
   organiserNote: text(280),
   anglerNote: text(200),
});

export type JudgeVerdict = z.infer<typeof verdictSchema>;

/* The notes are shown on the page, so they are held to its style: no long
   dashes and no exclamation marks. Built from char codes so the source
   itself carries neither. */
const LONG_DASH = new RegExp(
   `\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`,
   'g'
);
const BANG = new RegExp(String.fromCharCode(0x21), 'g');
function tidy(value: string) {
   return value
      .replace(LONG_DASH, ', ')
      .replace(BANG, '.')
      .replace(/\s+/g, ' ')
      .trim();
}

export type JudgeRecord =
   | {
        status: 'checked';
        model: string;
        verdict: JudgeVerdict;
        /* Whether the judge sends the entry to the organiser, and why. */
        holds: boolean;
        holdReasons: string[];
        ms: number;
     }
   | {
        status: 'unchecked';
        reason:
           | 'no_key'
           | 'no_photo'
           | 'timeout'
           | 'malformed'
           | 'refused'
           | 'failed';
        model: string | null;
        ms: number;
        /* For the log when the call itself failed: the error's kind and
           status, never its message, which can quote the request. */
        error?: string;
     };

/* ---- The request ------------------------------------------------------ */

/* The checks this entry asks about. A most-species entry has no figure. */
export function checksFor(competition: Pick<JudgeCompetition, 'rule'>) {
   return CHECK_CODES.filter(
      (code) => code !== 'figure' || competition.rule !== 'SPECIES_VARIETY'
   );
}

const RULE_WORDS: Record<JudgeCompetition['rule'], string> = {
   BIGGEST_FISH: 'Biggest single fish',
   SPECIES_POINTS: 'Total of the best fish per species per day',
   SPECIES_VARIETY: 'Most different species',
};

/* A time as the competition's own clock reads it. */
function localTime(at: Date | null, timeZone: string) {
   if (!at) return null;
   try {
      return new Intl.DateTimeFormat('en-ZA', {
         timeZone,
         weekday: 'short',
         day: 'numeric',
         month: 'short',
         year: 'numeric',
         hour: '2-digit',
         minute: '2-digit',
         hour12: false,
      }).format(at);
   } catch {
      return at.toISOString();
   }
}

/* "52 cm (20.5 in)", "2.36 kg (5.2 lb)": the claim in both units, so the
   judge compares like with like whatever the tape or scale is marked in. */
export function claimWords(value: number | null, measure: 'LENGTH' | 'WEIGHT') {
   if (value === null) return null;
   const round = (n: number, places: number) =>
      Math.round(n * 10 ** places) / 10 ** places;
   return measure === 'LENGTH'
      ? `${round(value, 1)} cm (${round(value / 2.54, 1)} in)`
      : `${round(value, 2)} kg (${round(value / 0.45359237, 2)} lb)`;
}

const lineFor = (report: ReportLine[], code: CheckCode) =>
   report.find((line) => line.code === code) ?? null;

const outcome = (line: ReportLine | null) =>
   !line
      ? 'not run'
      : line.status === 'pass'
        ? `passed: ${line.detail}`
        : line.status === 'flag'
          ? `flagged: ${line.detail}`
          : `not checked: ${line.detail}`;

/**
 * The facts of this entry, as the user turn carries them. Pure, so the
 * tests can read exactly what the judge is told.
 */
export function buildFacts(input: JudgeInput) {
   const { competition: c, entry: e } = input;
   const zone = c.timeZoneId;
   const judgedOn =
      c.rule === 'SPECIES_VARIETY'
         ? 'Number of different species; no measure is needed'
         : c.measure === 'LENGTH'
           ? 'Length, total length from nose to tail, in cm'
           : 'Weight, in kg';
   const area =
      c.areaType === 'ANYWHERE' || !c.areaName
         ? 'Anywhere in South Africa'
         : c.areaType === 'WATERBODY'
           ? `Within ${c.areaRadiusKm ?? 25} km of ${c.areaName}`
           : `The province of ${c.areaName}`;
   const duplicate = lineFor(e.report, 'duplicate');
   return {
      competition: {
         name: c.name,
         organiserNotes: c.blurb,
         rule: RULE_WORDS[c.rule],
         judgedOn,
         species: c.species.length
            ? c.species.map((s) => ({
                 commonName: s.commonName,
                 scientificName: s.scientificName,
              }))
            : 'Any species',
         window: {
            opens: localTime(c.startsAt, zone),
            closes: localTime(c.endsAt, zone),
            timeZone: zone,
         },
         area,
         bestFishPerSpeciesPerDay:
            c.rule === 'SPECIES_POINTS' ? c.maxPerSpeciesPerDay : null,
         entriesCount:
            c.checks === 'REVIEW'
               ? 'After the organiser accepts each one'
               : 'As soon as the checks pass',
         measurePhotoRequired: c.rule !== 'SPECIES_VARIETY',
      },
      entry: {
         claimedSpecies: e.speciesName,
         claimedFigure:
            c.rule === 'SPECIES_VARIETY'
               ? null
               : claimWords(e.declaredValue, c.measure),
         caughtAt: localTime(e.caughtAt, zone),
         fishPhotoCameraTime:
            localTime(e.photoTakenAt, zone) ?? 'Not in the file',
         measurePhotoCameraTime:
            c.rule === 'SPECIES_VARIETY'
               ? null
               : (localTime(e.measureTakenAt, zone) ?? 'Not in the file'),
         submittedAt: localTime(e.submittedAt, zone),
      },
      automatedChecks: {
         positionCheck: outcome(lineFor(e.report, 'area')),
         duplicateFingerprint: !duplicate
            ? 'not run'
            : duplicate.status === 'flag'
              ? `fired: ${duplicate.detail}`
              : `did not fire: ${duplicate.detail}`,
         speciesNamer: outcome(lineFor(e.report, 'species')),
         windowCheck: outcome(lineFor(e.report, 'window')),
      },
   };
}

/* The tool the judge must answer through. Strict, so the arguments always
   parse; the zod schema above still checks them, because strict mode cannot
   say "a number from 0 to 1" and a schema is only as good as its reader. */
export const JUDGE_TOOL_DEF: Anthropic.Tool = {
   name: JUDGE_TOOL,
   description:
      'Report the judgement of one competition entry: a verdict per check, the figure read off the measure photo, the photo comparisons, tamper signs, the overall verdict and the two notes.',
   strict: true,
   input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
         checks: {
            type: 'array',
            description: 'One verdict for each check the request lists.',
            items: {
               type: 'object',
               additionalProperties: false,
               properties: {
                  check: { type: 'string', enum: [...CHECK_CODES] },
                  verdict: { type: 'string', enum: ['pass', 'fail', 'unsure'] },
                  reason: {
                     type: 'string',
                     description: 'One short sentence: what decided it.',
                  },
               },
               required: ['check', 'verdict', 'reason'],
            },
         },
         measure: {
            type: 'object',
            description: 'The figure read off the measure in Photo 2.',
            additionalProperties: false,
            properties: {
               value: {
                  type: ['number', 'null'],
                  description: 'The figure read, or null if it cannot be read.',
               },
               unit: {
                  type: ['string', 'null'],
                  enum: ['cm', 'in', 'kg', 'lb', null],
                  description: 'The unit printed on the measure.',
               },
               confidence: {
                  type: 'number',
                  description: 'How sure of the reading, 0 to 1.',
               },
               seen: {
                  type: 'string',
                  enum: ['tape', 'board', 'scale', 'none'],
                  description: 'The measuring device visible in Photo 2.',
               },
            },
            required: ['value', 'unit', 'confidence', 'seen'],
         },
         fishVisibleOnMeasure: {
            type: 'string',
            enum: ['yes', 'no', 'unsure'],
         },
         sameFishInBothPhotos: {
            type: 'string',
            enum: ['yes', 'no', 'unsure'],
         },
         species: {
            type: 'object',
            additionalProperties: false,
            properties: {
               plausible: { type: 'string', enum: ['yes', 'no', 'unsure'] },
               bestGuess: {
                  type: ['string', 'null'],
                  description:
                     'Your best guess at the species, by common name.',
               },
            },
            required: ['plausible', 'bestGuess'],
         },
         tamperSigns: {
            type: 'array',
            description:
               'Only signs actually visible. Empty when there are none.',
            items: {
               type: 'object',
               additionalProperties: false,
               properties: {
                  kind: {
                     type: 'string',
                     enum: ['screen', 'edited_digits', 'lighting', 'other'],
                  },
                  detail: { type: 'string' },
               },
               required: ['kind', 'detail'],
            },
         },
         overall: { type: 'string', enum: ['accept', 'review', 'reject'] },
         organiserNote: { type: 'string' },
         anglerNote: { type: 'string' },
      },
      required: [
         'checks',
         'measure',
         'fishVisibleOnMeasure',
         'sameFishInBothPhotos',
         'species',
         'tamperSigns',
         'overall',
         'organiserNote',
         'anglerNote',
      ],
   },
};

/**
 * The whole request for one entry. The system prompt and the tool are the
 * same bytes for every entry, which is what lets them be cached; nothing
 * about the entry is allowed above the marker.
 */
export function buildJudgeRequest(
   input: JudgeInput,
   images: { fish: ImageForModel | null; measure: ImageForModel | null }
): Anthropic.MessageCreateParamsNonStreaming {
   const asked = checksFor(input.competition);
   const measureWord =
      input.competition.measure === 'LENGTH'
         ? 'on the tape or measuring board'
         : 'on the scale';
   const content: Anthropic.ContentBlockParam[] = [
      {
         type: 'text',
         text: `<entry_facts>\n${JSON.stringify(buildFacts(input), null, 1)}\n</entry_facts>`,
      },
   ];
   const picture = (label: string, image: ImageForModel) => {
      content.push({ type: 'text', text: label });
      content.push({
         type: 'image',
         source: {
            type: 'base64',
            media_type: image.mediaType,
            data: image.data,
         },
      });
   };
   if (images.fish) picture('Photo 1, the fish:', images.fish);
   else
      content.push({ type: 'text', text: 'Photo 1, the fish: not supplied.' });
   if (input.competition.rule !== 'SPECIES_VARIETY') {
      if (images.measure)
         picture(`Photo 2, the fish ${measureWord}:`, images.measure);
      else
         content.push({
            type: 'text',
            text: `Photo 2, the fish ${measureWord}: not supplied.`,
         });
   }
   content.push({
      type: 'text',
      text: `Judge this entry. Give one verdict for each of these checks, and no others: ${asked.join(', ')}. Answer with the ${JUDGE_TOOL} tool.`,
   });

   return {
      model: JUDGE_MODEL,
      max_tokens: 8000,
      /*
       * No extended thinking. The API refuses thinking alongside a forced
       * tool_choice (only auto or none are allowed with it), so asking for
       * both turned every call into a 400 and every entry into "not seen by
       * the judge". The forced tool is the part that matters: it is what
       * guarantees an answer the reader can check. The care thinking would
       * have bought is asked for in the tool itself, a reason per check.
       */
      system: [
         {
            type: 'text',
            text: JUDGE_SYSTEM,
            cache_control: { type: 'ephemeral' },
         },
      ],
      tools: [JUDGE_TOOL_DEF],
      tool_choice: { type: 'tool', name: JUDGE_TOOL },
      messages: [{ role: 'user', content }],
   };
}

/* ---- Reading the answer ----------------------------------------------- */

/* The checks that decide whether a fish is what it says: an unsure on any of
   these is a question for the organiser, not a pass. */
const DECIDING: readonly CheckCode[] = ['fish', 'species', 'figure'];

/** Why the judge would send this entry to the organiser; empty when it would not. */
export function holdReasons(
   verdict: JudgeVerdict,
   hasMeasure: boolean
): string[] {
   const reasons: string[] = [];
   if (verdict.overall !== 'accept') reasons.push(`overall ${verdict.overall}`);
   for (const line of verdict.checks) {
      if (line.verdict === 'fail') reasons.push(`${line.check} failed`);
      else if (line.verdict === 'unsure' && DECIDING.includes(line.check))
         reasons.push(`${line.check} unsure`);
   }
   if (verdict.tamperSigns.length) reasons.push('tamper signs');
   if (verdict.species.plausible === 'no') reasons.push('species implausible');
   if (hasMeasure) {
      if (verdict.fishVisibleOnMeasure === 'no')
         reasons.push('fish not on the measure');
      if (verdict.sameFishInBothPhotos === 'no')
         reasons.push('different fish in the two photos');
   }
   return reasons;
}

/**
 * The tool call out of a response, checked. Null when there is none or it
 * does not fit: a check missing that was asked for counts as not fitting,
 * because a judgement with a hole in it is not one to act on.
 */
export function readVerdict(
   message: Pick<Anthropic.Message, 'content' | 'stop_reason'>,
   asked: readonly CheckCode[]
): JudgeVerdict | null {
   const call = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
         block.type === 'tool_use' && block.name === JUDGE_TOOL
   );
   if (!call) return null;
   const parsed = verdictSchema.safeParse(call.input);
   if (!parsed.success) return null;
   const seen = new Set<CheckCode>();
   const checks = parsed.data.checks.filter((line) => {
      if (!asked.includes(line.check) || seen.has(line.check)) return false;
      seen.add(line.check);
      return true;
   });
   if (asked.some((code) => !seen.has(code))) return null;
   /* A figure with no unit, or a unit with no figure, is no reading. */
   const m = parsed.data.measure;
   const measure =
      m.value === null || m.unit === null
         ? { ...m, value: null, unit: null }
         : m;
   return { ...parsed.data, checks, measure };
}

/* ---- Running it ------------------------------------------------------- */

type MessagesClient = {
   messages: {
      create: (
         body: Anthropic.MessageCreateParamsNonStreaming,
         options?: {
            signal?: AbortSignal;
            timeout?: number;
            maxRetries?: number;
         }
      ) => Promise<
         Pick<Anthropic.Message, 'content' | 'stop_reason' | 'usage'>
      >;
   };
};

let sharedClient: Anthropic | null = null;
function defaultClient(): MessagesClient | null {
   if (!process.env.ANTHROPIC_API_KEY) return null;
   /* No retries: a retry is another 20 seconds, and the entry is better off
      going on as it would have than waiting a minute for a second opinion. */
   sharedClient ??= new Anthropic({ maxRetries: 0, timeout: JUDGE_TIMEOUT_MS });
   return sharedClient;
}

/* The same request with strict mode taken off every tool. */
export const withoutStrict = (
   request: Anthropic.MessageCreateParamsNonStreaming
): Anthropic.MessageCreateParamsNonStreaming => ({
   ...request,
   tools: request.tools?.map((tool) => {
      const { strict: _strict, ...rest } = tool as Anthropic.Tool;
      return rest;
   }),
});

export type JudgeDeps = {
   /* Null means no key: the judge is off. Left out, the real client. */
   client?: MessagesClient | null;
   /* Fetches a photograph for the model. Must strip its location. */
   loadImage: (url: string, signal: AbortSignal) => Promise<ImageForModel>;
   timeoutMs?: number;
};

/**
 * Judge one entry. Never throws: every way it can go wrong comes back as
 * `unchecked` with the reason, and the caller carries on without it.
 */
export async function judgeEntry(
   input: JudgeInput,
   deps: JudgeDeps
): Promise<JudgeRecord> {
   const started = Date.now();
   const ms = () => Date.now() - started;
   const client = deps.client === undefined ? defaultClient() : deps.client;
   if (!client)
      return { status: 'unchecked', reason: 'no_key', model: null, ms: ms() };
   if (!input.photos.fish && !input.photos.measure)
      return { status: 'unchecked', reason: 'no_photo', model: null, ms: ms() };

   const controller = new AbortController();
   const timeoutMs = deps.timeoutMs ?? JUDGE_TIMEOUT_MS;
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   /* The loader and the call both listen to the one signal, and the race
      makes sure a client that ignores it cannot hold the entry past it. */
   const deadline = new Promise<'timeout'>((resolve) =>
      controller.signal.addEventListener('abort', () => resolve('timeout'))
   );
   try {
      const load = (url: string | null) =>
         url ? deps.loadImage(url, controller.signal).catch(() => null) : null;
      const work = (async () => {
         const [fish, measure] = await Promise.all([
            load(input.photos.fish),
            load(input.photos.measure),
         ]);
         if (!fish && !measure) return 'no_photo' as const;
         const request = buildJudgeRequest(input, { fish, measure });
         const options = {
            signal: controller.signal,
            timeout: timeoutMs,
            maxRetries: 0,
         };
         try {
            return await client.messages.create(request, options);
         } catch (error) {
            /*
             * Strict tool schemas accept only a subset of JSON Schema, and
             * this one has not met the live API yet. If it is the schema
             * being turned down, ask once more without strict: the zod reader
             * checks the answer either way, so strict only ever saved a
             * malformed answer, never a wrong one.
             */
            if (
               error instanceof Anthropic.BadRequestError &&
               !controller.signal.aborted
            ) {
               return client.messages.create(withoutStrict(request), options);
            }
            throw error;
         }
      })();
      const result = await Promise.race([work, deadline]);
      if (result === 'timeout' || controller.signal.aborted)
         return {
            status: 'unchecked',
            reason: 'timeout',
            model: JUDGE_MODEL,
            ms: ms(),
         };
      if (result === 'no_photo')
         return {
            status: 'unchecked',
            reason: 'no_photo',
            model: null,
            ms: ms(),
         };
      if (result.stop_reason === 'refusal')
         return {
            status: 'unchecked',
            reason: 'refused',
            model: JUDGE_MODEL,
            ms: ms(),
         };
      const verdict = readVerdict(result, checksFor(input.competition));
      if (!verdict)
         return {
            status: 'unchecked',
            reason: 'malformed',
            model: JUDGE_MODEL,
            ms: ms(),
         };
      const reasons = holdReasons(
         verdict,
         input.competition.rule !== 'SPECIES_VARIETY'
      );
      return {
         status: 'checked',
         model: JUDGE_MODEL,
         verdict,
         holds: reasons.length > 0,
         holdReasons: reasons,
         ms: ms(),
      };
   } catch (error) {
      const timedOut =
         controller.signal.aborted ||
         error instanceof Anthropic.APIConnectionTimeoutError ||
         error instanceof Anthropic.APIUserAbortError;
      return {
         status: 'unchecked',
         reason: timedOut ? 'timeout' : 'failed',
         model: JUDGE_MODEL,
         ms: ms(),
         error:
            error instanceof Anthropic.APIError
               ? `${error.constructor.name} ${error.status ?? ''}`.trim()
               : error instanceof Error
                 ? error.name
                 : 'unknown',
      };
   } finally {
      clearTimeout(timer);
   }
}

/* The judge's figure in the shape the figure check reads. */
export function judgeReading(verdict: JudgeVerdict) {
   const figure = verdict.checks.find((line) => line.check === 'figure');
   return {
      value: verdict.measure.value,
      unit: verdict.measure.unit,
      confidence: verdict.measure.confidence,
      seen:
         verdict.measure.seen === 'board'
            ? ('tape' as const)
            : verdict.measure.seen,
      note: figure?.reason ?? verdict.organiserNote,
   };
}

/* Words for the log and the page when the judge did not look. */
export const UNCHECKED_WORDS: Record<
   Extract<JudgeRecord, { status: 'unchecked' }>['reason'],
   string
> = {
   no_key: 'The judge is not switched on for this server.',
   no_photo: 'There was no photograph for the judge to look at.',
   timeout: 'The judge took too long to answer.',
   malformed: 'The judge gave an answer that could not be read.',
   refused: 'The judge declined to look at this one.',
   failed: 'The judge could not be reached.',
};
