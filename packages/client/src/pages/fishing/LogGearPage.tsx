import axios from 'axios';
import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRevealIn } from '@/components/brand/Reveal';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { ChoiceGroup, TextField } from '@/components/ui/field';
import { toast } from '@/components/ui/use-toast';
import { useDocumentTitle } from '@/lib/title';

export type GearType =
   | 'ROD'
   | 'REEL'
   | 'BAIT'
   | 'LURE'
   | 'LINE'
   | 'HOOK'
   | 'WEIGHTS'
   | 'RIG';

export type GearValues = {
   name: string;
   brand: string;
   type: GearType;
   imageUrl: string | null;
};

type GearImage = { storageKey: string; url: string };

type GearFieldName = 'name' | 'brand';

const GEAR_KINDS: { value: GearType; word: string }[] = [
   { value: 'ROD', word: 'Rod' },
   { value: 'REEL', word: 'Reel' },
   { value: 'BAIT', word: 'Bait' },
   { value: 'LURE', word: 'Lure' },
   { value: 'LINE', word: 'Line' },
   { value: 'HOOK', word: 'Hook' },
   { value: 'WEIGHTS', word: 'Weights' },
   { value: 'RIG', word: 'Rig' },
];

const TEXT_MAX = 120;

const MESSAGES: Record<GearFieldName, string> = {
   name: 'The gear needs a name.',
   brand: 'Say who makes it.',
};

const EMPTY_GEAR: GearValues = {
   name: '',
   brand: '',
   type: 'ROD',
   imageUrl: null,
};

/* A word that is not allowed is said as the server says it; any other
   refusal of the field keeps the form's own sentence. */
const refusal = (field: { _errors?: string[] } | undefined) =>
   field?._errors?.find((text) => text.includes('not allowed on Fisherfeed'));

const refusedFields = (
   error: unknown
): Partial<Record<GearFieldName, string>> => {
   if (!axios.isAxiosError(error) || error.response?.status !== 400) {
      return {};
   }

   const body = error.response.data as
      | Record<string, { _errors?: string[] } | undefined>
      | undefined;

   if (!body) {
      return {};
   }

   const refused: Partial<Record<GearFieldName, string>> = {};

   if (body.name?._errors?.length) {
      refused.name = refusal(body.name) ?? MESSAGES.name;
   }
   if (body.brand?._errors?.length) {
      refused.brand = MESSAGES.brand;
   }

   return refused;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
   const headingId = useId();

   return (
      <section aria-labelledby={headingId} className="rule-dashed rv pt-6">
         <h2 id={headingId} className="lab">
            {title}
         </h2>
         <div className="mt-6 grid gap-6">{children}</div>
      </section>
   );
}

/** The skeleton the gear form leaves while the record it edits is loading. */
export function GearFormSkeleton() {
   return (
      <div className="grid gap-10" aria-hidden="true">
         <div className="grid gap-6">
            <div className="h-4 w-[7ch] bg-bg-2" />
            <div className="h-11 w-full bg-bg-2" />
            <div className="h-11 w-full bg-bg-2" />
         </div>
         <div className="flex flex-wrap gap-2">
            {GEAR_KINDS.map((kind) => (
               <div key={kind.value} className="h-11 w-[8ch] bg-bg-2" />
            ))}
         </div>
         <div className="aspect-[4/3] w-full max-w-[320px] bg-bg-2" />
      </div>
   );
}

/**
 * One form for adding gear and for editing it. Editing prefills it and keeps the
 * photo already on the record unless a new one is chosen.
 */
export function GearForm({
   gearId,
   initial,
}: {
   gearId?: string;
   initial?: GearValues;
}) {
   const isEditing = Boolean(gearId);
   const navigate = useNavigate();
   const formRef = useRef<HTMLFormElement | null>(null);
   const nameRef = useRef<HTMLInputElement | null>(null);
   const brandRef = useRef<HTMLInputElement | null>(null);
   useRevealIn(formRef);

   const [values, setValues] = useState<GearValues>(initial ?? EMPTY_GEAR);
   const [errors, setErrors] = useState<Partial<Record<GearFieldName, string>>>(
      {}
   );
   const [images, setImages] = useState<GearImage[]>([]);
   const [isSaving, setIsSaving] = useState(false);

   const change = <K extends keyof GearValues>(key: K, value: GearValues[K]) =>
      setValues((current) => ({ ...current, [key]: value }));

   const clearError = (field: GearFieldName) =>
      setErrors((current) => ({ ...current, [field]: undefined }));

   const checkText = (field: GearFieldName, value: string) => {
      const problem = value.trim().length < 1 ? MESSAGES[field] : undefined;
      setErrors((current) => ({ ...current, [field]: problem }));
      return !problem;
   };

   const save = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nameIsGood = checkText('name', values.name);
      const brandIsGood = checkText('brand', values.brand);

      if (!nameIsGood) {
         nameRef.current?.focus();
         return;
      }

      if (!brandIsGood) {
         brandRef.current?.focus();
         return;
      }

      const trimmedName = values.name.trim();
      const payload: {
         name: string;
         brand: string;
         type: GearType;
         image?: GearImage | null;
      } = {
         name: trimmedName,
         brand: values.brand.trim(),
         type: values.type,
      };

      if (images[0]) {
         payload.image = images[0];
      } else if (!isEditing) {
         payload.image = null;
      }

      try {
         setIsSaving(true);

         if (gearId) {
            await axios.put(`/api/gear/${gearId}`, payload);
         } else {
            await axios.post('/api/gear', payload);
         }

         toast({
            title: 'Gear saved.',
            description: `${trimmedName} is in your gear.`,
            variant: 'success',
         });
         navigate('/gear/me', { replace: true });
      } catch (error) {
         console.error(error);
         const refused = refusedFields(error);

         if (Object.keys(refused).length) {
            setErrors(refused);
            (refused.name ? nameRef : brandRef).current?.focus();
            return;
         }

         toast({
            title: 'Not saved.',
            description: 'The gear did not reach us. Try again.',
            variant: 'error',
         });
      } finally {
         setIsSaving(false);
      }
   };

   const shownPhoto = images[0]?.url ?? values.imageUrl;

   return (
      <form ref={formRef} onSubmit={save} noValidate className="grid gap-10">
         <Group title="The gear">
            <TextField
               ref={nameRef}
               label="Name"
               value={values.name}
               maxLength={TEXT_MAX}
               autoComplete="off"
               error={errors.name}
               hint="The model, or what you call it."
               onChange={(event) => {
                  clearError('name');
                  change('name', event.target.value);
               }}
               onBlur={(event) => checkText('name', event.target.value)}
            />

            <TextField
               ref={brandRef}
               label="Brand"
               value={values.brand}
               maxLength={TEXT_MAX}
               autoComplete="off"
               error={errors.brand}
               onChange={(event) => {
                  clearError('brand');
                  change('brand', event.target.value);
               }}
               onBlur={(event) => checkText('brand', event.target.value)}
            />

            <ChoiceGroup
               label="Type"
               value={values.type}
               options={GEAR_KINDS.map((kind) => ({
                  value: kind.value,
                  label: kind.word,
               }))}
               onChange={(next) => change('type', next)}
            />
         </Group>

         <Group title="Photo">
            {/* TODO(api): a photo can be replaced but never cleared, because the
                update route reads a missing image as "keep the one you have",
                appendix E item 6. */}
            {shownPhoto ? (
               <img
                  src={shownPhoto}
                  alt={values.name || 'The gear'}
                  width={320}
                  height={240}
                  loading="lazy"
                  className="aspect-[4/3] w-full max-w-[320px] border border-line bg-bg-2 object-contain"
               />
            ) : null}
            <R2ImagePicker
               scope="gear"
               label={shownPhoto ? 'Replace the photo' : 'One photo'}
               value={images}
               onChange={setImages}
               multiple={false}
               maxItems={1}
            />
         </Group>

         <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={isSaving}>
               {isEditing ? 'Save changes' : 'Save gear'}
            </Button>
            <Button variant="ghost" size="lg" asChild>
               <Link to="/gear/me">Cancel</Link>
            </Button>
         </div>
      </form>
   );
}

export function LogGearPage() {
   useDocumentTitle('Add gear');

   return (
      <RequireSignIn what="your gear">
         <section className="mx-auto w-[min(1400px,100%-32px)] py-10 md:py-14">
            <h1 className="g text-[44px] md:text-[56px]">Add gear</h1>
            <p className="mt-3 max-w-[52ch] text-ink-2">
               Name it, say who makes it and what it is. You can then put it on
               a catch.
            </p>
            <div className="mt-10">
               <GearForm />
            </div>
         </section>
      </RequireSignIn>
   );
}
