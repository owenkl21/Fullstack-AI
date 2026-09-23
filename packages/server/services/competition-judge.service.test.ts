import { describe, expect, test } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import {
   JUDGE_MODEL,
   buildFacts,
   buildJudgeRequest,
   checksFor,
   claimWords,
   judgeEntry,
   judgeReading,
   readVerdict,
   type JudgeInput,
} from './competition-judge.service';

/*
 * The judge without the network. The client is a stub that records what it
 * was sent and answers what the test says, and the image loader hands back a
 * few bytes, so these run with no key and no bucket.
 */

const IMAGE = { data: 'aGVsbG8=', mediaType: 'image/jpeg' as const };
const loadImage = async () => IMAGE;

function input(overrides: Partial<JudgeInput['competition']> = {}): JudgeInput {
   return {
      competition: {
         name: 'Vaal Bass Weekend',
         blurb: 'Minimum 30 cm. Release every fish.',
         rule: 'BIGGEST_FISH',
         measure: 'LENGTH',
         checks: 'CASUAL',
         species: [],
         startsAt: new Date('2026-09-26T04:00:00Z'),
         endsAt: new Date('2026-09-27T13:00:00Z'),
         timeZoneId: 'Africa/Johannesburg',
         maxPerSpeciesPerDay: 3,
         areaType: 'WATERBODY',
         areaName: 'Vaal Dam',
         areaRadiusKm: 25,
         ...overrides,
      },
      entry: {
         speciesName: 'Largemouth bass',
         declaredValue: 52,
         caughtAt: new Date('2026-09-26T06:40:00Z'),
         photoTakenAt: new Date('2026-09-26T06:41:00Z'),
         measureTakenAt: null,
         submittedAt: new Date('2026-09-26T07:02:00Z'),
         report: [
            {
               code: 'area',
               status: 'pass',
               detail: '11 km from Vaal Dam, within 25 km.',
            },
            { code: 'duplicate', status: 'pass', detail: 'The first entry.' },
            {
               code: 'window',
               status: 'pass',
               detail: 'Caught and photographed inside the dates.',
            },
         ],
      },
      photos: {
         fish: 'https://bucket.example/users/u1/catches/temp/fish.jpg',
         measure: 'https://bucket.example/users/u1/catches/temp/tape.jpg',
      },
   };
}

/* A good answer, as the tool call would carry it. */
function goodAnswer(asked = checksFor(input().competition)) {
   return {
      checks: asked.map((check) => ({
         check,
         verdict: 'pass',
         reason:
            check === 'figure' ? 'The tape reads 52 cm at the tail.' : 'Fine.',
      })),
      measure: { value: 52, unit: 'cm', confidence: 0.92, seen: 'board' },
      fishVisibleOnMeasure: 'yes',
      sameFishInBothPhotos: 'yes',
      species: { plausible: 'yes', bestGuess: 'Largemouth bass' },
      tamperSigns: [],
      overall: 'accept',
      organiserNote: 'Board reads 52 cm, nose at the stop.',
      /* A long dash and a bang, which tidy() must take out. */
      anglerNote: `The board reads 52 cm ${String.fromCharCode(0x2014)} a fine bass${String.fromCharCode(0x21)}`,
   };
}

function reply(toolInput: unknown, stop: Anthropic.StopReason = 'tool_use') {
   return {
      stop_reason: stop,
      usage: {} as Anthropic.Usage,
      content: [
         {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'judge_entry',
            input: toolInput,
         } as Anthropic.ToolUseBlock,
      ],
   };
}

function stubClient(answer: () => Promise<ReturnType<typeof reply>>) {
   const sent: Anthropic.MessageCreateParamsNonStreaming[] = [];
   return {
      sent,
      client: {
         messages: {
            create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
               sent.push(body);
               return answer();
            },
         },
      },
   };
}

describe('the prompt', () => {
   test('the system prompt and tool are the same bytes for every entry, behind a cache marker', () => {
      const a = buildJudgeRequest(input(), { fish: IMAGE, measure: IMAGE });
      const b = buildJudgeRequest(
         input({
            name: 'Another one',
            species: [
               {
                  id: 's1',
                  commonName: 'Carp',
                  scientificName: 'Cyprinus carpio',
               },
            ],
         }),
         { fish: IMAGE, measure: null }
      );
      expect(a.model).toBe(JUDGE_MODEL);
      expect(JUDGE_MODEL).toBe('claude-sonnet-5');
      expect(JSON.stringify(a.system)).toBe(JSON.stringify(b.system));
      expect(JSON.stringify(a.tools)).toBe(JSON.stringify(b.tools));
      const system = a.system as Anthropic.TextBlockParam[];
      expect(system).toHaveLength(1);
      expect(system[0]!.cache_control).toEqual({ type: 'ephemeral' });
      /* The rubric and the shared reading rules are both in it. */
      expect(system[0]!.text).toContain('You are the judge');
      expect(system[0]!.text).toContain('How to read a measurement');
      /* Nothing about the entry sits above the marker. */
      expect(system[0]!.text).not.toContain('Vaal');
      expect(a.tool_choice).toEqual({ type: 'tool', name: 'judge_entry' });
      expect(a.tools?.[0]).toMatchObject({ name: 'judge_entry', strict: true });
   });

   test('both photographs go in the user turn, each labelled for what it is', () => {
      const request = buildJudgeRequest(input(), {
         fish: IMAGE,
         measure: IMAGE,
      });
      const content = request.messages[0]!
         .content as Anthropic.ContentBlockParam[];
      const kinds = content.map((block) =>
         block.type === 'text' ? `text:${block.text.slice(0, 22)}` : block.type
      );
      expect(kinds).toEqual([
         'text:<entry_facts>\n{\n "comp',
         'text:Photo 1, the fish:',
         'image',
         'text:Photo 2, the fish on t',
         'image',
         'text:Judge this entry. Give',
      ]);
      const last = content[content.length - 1] as Anthropic.TextBlockParam;
      expect(last.text).toContain(
         'fish, species, figure, window, area, duplicate'
      );
      /* The facts carry no photograph data. */
      expect((content[0] as Anthropic.TextBlockParam).text).not.toContain(
         IMAGE.data
      );
   });

   test('a competition for any species says so, and the claim is in both units', () => {
      const facts = buildFacts(input());
      expect(facts.competition.species).toBe('Any species');
      expect(facts.competition.judgedOn).toContain('Length');
      expect(facts.competition.area).toBe('Within 25 km of Vaal Dam');
      expect(facts.competition.organiserNotes).toBe(
         'Minimum 30 cm. Release every fish.'
      );
      expect(facts.entry.claimedFigure).toBe('52 cm (20.5 in)');
      expect(facts.entry.fishPhotoCameraTime).toContain('08:41');
      expect(facts.entry.measurePhotoCameraTime).toBe('Not in the file');
      expect(facts.automatedChecks.positionCheck).toStartWith('passed');
      expect(facts.automatedChecks.duplicateFingerprint).toStartWith(
         'did not fire'
      );
   });

   test('a competition for several species lists each by both names', () => {
      const facts = buildFacts(
         input({
            measure: 'WEIGHT',
            species: [
               {
                  id: 'a',
                  commonName: 'Carp',
                  scientificName: 'Cyprinus carpio',
               },
               {
                  id: 'b',
                  commonName: 'Smallmouth yellowfish',
                  scientificName: 'Labeobarbus aeneus',
               },
            ],
         })
      );
      expect(facts.competition.species).toEqual([
         { commonName: 'Carp', scientificName: 'Cyprinus carpio' },
         {
            commonName: 'Smallmouth yellowfish',
            scientificName: 'Labeobarbus aeneus',
         },
      ]);
      expect(facts.competition.judgedOn).toBe('Weight, in kg');
      expect(claimWords(2.36, 'WEIGHT')).toBe('2.36 kg (5.2 lb)');
   });

   test('the fingerprint firing is told to the judge as fired', () => {
      const i = input();
      i.entry.report = [
         {
            code: 'duplicate',
            status: 'flag',
            detail: "Looks like the same fish as Sipho's entry (95% alike).",
         },
      ];
      expect(buildFacts(i).automatedChecks.duplicateFingerprint).toBe(
         "fired: Looks like the same fish as Sipho's entry (95% alike)."
      );
      expect(buildFacts(i).automatedChecks.positionCheck).toBe('not run');
   });

   test('a most-species competition asks no figure and shows one photograph', () => {
      const i = input({ rule: 'SPECIES_VARIETY' });
      expect(checksFor(i.competition)).not.toContain('figure');
      const request = buildJudgeRequest(i, { fish: IMAGE, measure: null });
      const content = request.messages[0]!
         .content as Anthropic.ContentBlockParam[];
      expect(content.filter((b) => b.type === 'image')).toHaveLength(1);
      expect(JSON.stringify(content)).not.toContain('Photo 2');
      expect(buildFacts(i).entry.claimedFigure).toBeNull();
   });
});

describe('the answer', () => {
   test('a good answer is read, tidied, and holds nothing', async () => {
      const stub = stubClient(async () => reply(goodAnswer()));
      const record = await judgeEntry(input(), {
         client: stub.client,
         loadImage,
      });
      expect(stub.sent).toHaveLength(1);
      expect(record.status).toBe('checked');
      if (record.status !== 'checked') return;
      expect(record.holds).toBe(false);
      expect(record.verdict.anglerNote).toBe(
         'The board reads 52 cm, a fine bass.'
      );
      expect(judgeReading(record.verdict)).toMatchObject({
         value: 52,
         unit: 'cm',
         seen: 'tape',
      });
   });

   test('an unsure reading or a different fish sends it to the organiser', async () => {
      const answer = goodAnswer();
      answer.checks = answer.checks.map((line) =>
         line.check === 'figure' ? { ...line, verdict: 'unsure' } : line
      );
      answer.sameFishInBothPhotos = 'no';
      const stub = stubClient(async () => reply(answer));
      const record = await judgeEntry(input(), {
         client: stub.client,
         loadImage,
      });
      expect(record.status).toBe('checked');
      if (record.status !== 'checked') return;
      expect(record.holds).toBe(true);
      expect(record.holdReasons).toEqual([
         'figure unsure',
         'different fish in the two photos',
      ]);
   });

   test('a reject is a hold, never more', async () => {
      const answer = {
         ...goodAnswer(),
         overall: 'reject',
         tamperSigns: [{ kind: 'screen', detail: 'Moire across the display.' }],
      };
      const stub = stubClient(async () => reply(answer));
      const record = await judgeEntry(input(), {
         client: stub.client,
         loadImage,
      });
      expect(record.status === 'checked' && record.holds).toBe(true);
   });

   test('a malformed tool result is not acted on', async () => {
      for (const bad of [
         { ...goodAnswer(), overall: 'maybe' },
         { ...goodAnswer(), checks: goodAnswer().checks.slice(1) },
         {
            ...goodAnswer(),
            measure: {
               value: 'fifty',
               unit: 'cm',
               confidence: 1,
               seen: 'tape',
            },
         },
         'not an object',
      ]) {
         const stub = stubClient(async () => reply(bad));
         const record = await judgeEntry(input(), {
            client: stub.client,
            loadImage,
         });
         expect(record).toMatchObject({
            status: 'unchecked',
            reason: 'malformed',
         });
      }
      /* No tool call at all. */
      const none = await judgeEntry(input(), {
         client: {
            messages: {
               create: async () => ({
                  stop_reason: 'end_turn' as const,
                  usage: {} as Anthropic.Usage,
                  content: [
                     {
                        type: 'text',
                        text: 'Looks fine.',
                        citations: null,
                     } as Anthropic.TextBlock,
                  ],
               }),
            },
         },
         loadImage,
      });
      expect(none).toMatchObject({ status: 'unchecked', reason: 'malformed' });
   });

   test('checks it was not asked about are dropped, and a figure with no unit is no reading', () => {
      const answer = goodAnswer();
      answer.checks.push({
         check: 'figure',
         verdict: 'fail',
         reason: 'A second opinion.',
      });
      answer.measure = {
         value: 52,
         unit: null as unknown as string,
         confidence: 0.9,
         seen: 'tape',
      };
      const verdict = readVerdict(
         reply(answer),
         checksFor(input().competition)
      );
      expect(verdict?.checks.filter((l) => l.check === 'figure')).toHaveLength(
         1
      );
      expect(verdict?.checks.find((l) => l.check === 'figure')?.verdict).toBe(
         'pass'
      );
      expect(verdict?.measure).toMatchObject({ value: null, unit: null });
   });

   test('a timeout lets the entry go on without the judge', async () => {
      const started = Date.now();
      /* A client that ignores the signal and never answers. */
      const record = await judgeEntry(input(), {
         client: { messages: { create: () => new Promise(() => {}) } },
         loadImage,
         timeoutMs: 60,
      });
      expect(record).toMatchObject({ status: 'unchecked', reason: 'timeout' });
      expect(Date.now() - started).toBeLessThan(2000);

      /* A client that honours the signal and throws on abort. */
      const aborting = await judgeEntry(input(), {
         client: {
            messages: {
               create: (_body, options) =>
                  new Promise((_, reject) =>
                     options?.signal?.addEventListener('abort', () =>
                        reject(new Error('aborted'))
                     )
                  ),
            },
         },
         loadImage,
         timeoutMs: 60,
      });
      expect(aborting).toMatchObject({
         status: 'unchecked',
         reason: 'timeout',
      });
   });

   test('no key, no photographs, a refusal and a failure are all not checked', async () => {
      expect(
         await judgeEntry(input(), { client: null, loadImage })
      ).toMatchObject({
         status: 'unchecked',
         reason: 'no_key',
      });
      const failingLoad = async () => {
         throw new Error('404');
      };
      const stub = stubClient(async () => reply(goodAnswer()));
      expect(
         await judgeEntry(input(), {
            client: stub.client,
            loadImage: failingLoad,
         })
      ).toMatchObject({
         status: 'unchecked',
         reason: 'no_photo',
      });
      expect(stub.sent).toHaveLength(0);
      const refused = stubClient(async () => reply(goodAnswer(), 'refusal'));
      expect(
         await judgeEntry(input(), { client: refused.client, loadImage })
      ).toMatchObject({
         status: 'unchecked',
         reason: 'refused',
      });
      const broken = stubClient(async () => {
         throw new Error('500');
      });
      expect(
         await judgeEntry(input(), { client: broken.client, loadImage })
      ).toMatchObject({
         status: 'unchecked',
         reason: 'failed',
      });
   });
});

describe('what the live API accepts', () => {
   test('no extended thinking: the API refuses it beside a forced tool', () => {
      const request = buildJudgeRequest(input(), {
         fish: IMAGE,
         measure: IMAGE,
      });
      expect(request.tool_choice).toEqual({
         type: 'tool',
         name: 'judge_entry',
      });
      expect('thinking' in request).toBe(false);
      expect(request.output_config).toEqual({ effort: 'medium' });
      expect(request.model).toBe('claude-sonnet-5');
   });

   test('a schema the API turns down is asked again once, without strict', async () => {
      let calls = 0;
      const sent: Anthropic.MessageCreateParamsNonStreaming[] = [];
      const client = {
         messages: {
            create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
               sent.push(body);
               calls += 1;
               if (calls === 1)
                  throw new Anthropic.BadRequestError(
                     400,
                     {
                        type: 'error',
                        error: {
                           type: 'invalid_request_error',
                           message: 'schema',
                        },
                     },
                     'schema',
                     new Headers()
                  );
               return reply(goodAnswer());
            },
         },
      };
      const record = await judgeEntry(input(), { client, loadImage });
      expect(calls).toBe(2);
      expect((sent[0]!.tools![0] as Anthropic.Tool).strict).toBe(true);
      expect('strict' in (sent[1]!.tools![0] as Anthropic.Tool)).toBe(false);
      expect(sent[1]!.output_config).toBeUndefined();
      expect(record).toMatchObject({ status: 'checked' });
   });
});
