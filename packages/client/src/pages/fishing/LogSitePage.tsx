import axios from 'axios';
import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapLocationPicker } from '@/components/fishing/MapLocationPicker';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { useRevealIn } from '@/components/brand/Reveal';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { ChoiceGroup, TextArea, TextField } from '@/components/ui/field';
import { toast } from '@/components/ui/use-toast';
import { readPosition } from '@/lib/maps';
import { useDocumentTitle } from '@/lib/title';

export type WaterType = 'FRESHWATER' | 'SALTWATER' | 'BRACKISH' | 'OTHER';

export type SpotValues = {
   name: string;
   description: string;
   waterType: WaterType | '';
   accessNotes: string;
   latitude: string;
   longitude: string;
};

type SpotImage = { storageKey: string; url: string };

type SpotFieldName = 'name' | 'description' | 'accessNotes' | 'position';

/* Salt or fresh. A river mouth is fished as one or the other on the day. */
const WATER_TYPES: { value: WaterType; word: string }[] = [
   { value: 'SALTWATER', word: 'Salt' },
   { value: 'FRESHWATER', word: 'Fresh' },
];

const NAME_MAX = 120;
const DESCRIPTION_MAX = 2000;
const ACCESS_NOTES_MAX = 500;

const EMPTY_SPOT: SpotValues = {
   name: '',
   description: '',
   waterType: '',
   accessNotes: '',
   latitude: '',
   longitude: '',
};

const MESSAGES: Record<SpotFieldName, string> = {
   name: 'The name needs at least 2 characters.',
   description: `The description holds up to ${DESCRIPTION_MAX} characters.`,
   accessNotes: `The access notes hold up to ${ACCESS_NOTES_MAX} characters.`,
   position: 'That position is off the map. Place the pin again.',
};

/* The server answers a bad save with the fields it refused; say each one plainly. */
const refusedFields = (
   error: unknown
): Partial<Record<SpotFieldName, string>> => {
   if (!axios.isAxiosError(error) || error.response?.status !== 400) {
      return {};
   }

   const body = error.response.data as
      | Record<string, { _errors?: string[] } | undefined>
      | undefined;

   if (!body) {
      return {};
   }

   const refused: Partial<Record<SpotFieldName, string>> = {};

   if (body.name?._errors?.length) {
      refused.name = MESSAGES.name;
   }
   if (body.description?._errors?.length) {
      refused.description = MESSAGES.description;
   }
   if (body.accessNotes?._errors?.length) {
      refused.accessNotes = MESSAGES.accessNotes;
   }
   if (body.latitude?._errors?.length || body.longitude?._errors?.length) {
      refused.position = MESSAGES.position;
   }

   return refused;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
   const headingId = useId();

   return (
      <section aria-labelledby={headingId} className="rule-dashed rv pt-6">
         {/* The same voice the catch form uses. As a plain .lab this sat in
             the same tracked caps as the NAME label under it, so a section
             heading and a field label were indistinguishable. */}
         <h2 id={headingId} className="g text-[30px] md:text-[36px]">
            {title}
         </h2>
         <div className="mt-6 grid gap-6">{children}</div>
      </section>
   );
}

/** The skeleton a spot form leaves behind while the record it edits is loading. */
export function SpotFormSkeleton() {
   return (
      <div className="grid gap-10" aria-hidden="true">
         <div className="grid gap-6">
            <div className="h-4 w-[9ch] bg-bg-2" />
            <div className="h-11 w-full bg-bg-2" />
            <div className="flex gap-2">
               <div className="h-11 w-[9ch] bg-bg-2" />
               <div className="h-11 w-[9ch] bg-bg-2" />
               <div className="h-11 w-[12ch] bg-bg-2" />
            </div>
         </div>
         <div className="aspect-[3/2] w-full bg-bg-2" />
         <div className="h-[120px] w-full bg-bg-2" />
      </div>
   );
}

/**
 * One form for adding a spot and for editing one. Editing prefills it; everything
 * else about the two is the same, down to the words.
 */
export function SpotForm({
   siteId,
   initial,
}: {
   siteId?: string;
   initial?: SpotValues;
}) {
   const isEditing = Boolean(siteId);
   const navigate = useNavigate();
   const formRef = useRef<HTMLFormElement | null>(null);
   const nameRef = useRef<HTMLInputElement | null>(null);
   useRevealIn(formRef);

   const [values, setValues] = useState<SpotValues>(initial ?? EMPTY_SPOT);
   const [errors, setErrors] = useState<Partial<Record<SpotFieldName, string>>>(
      {}
   );
   const [images, setImages] = useState<SpotImage[]>([]);
   const [isSaving, setIsSaving] = useState(false);

   const position = readPosition(values.latitude, values.longitude);

   const change = <K extends keyof SpotValues>(key: K, value: SpotValues[K]) =>
      setValues((current) => ({ ...current, [key]: value }));

   const clearError = (field: SpotFieldName) =>
      setErrors((current) => ({ ...current, [field]: undefined }));

   const checkName = (value: string) => {
      const problem = value.trim().length < 2 ? MESSAGES.name : undefined;
      setErrors((current) => ({ ...current, name: problem }));
      return !problem;
   };

   const setCoordinates = (nextLatitude: number, nextLongitude: number) => {
      clearError('position');
      setValues((current) => ({
         ...current,
         latitude: nextLatitude.toFixed(6),
         longitude: nextLongitude.toFixed(6),
      }));
   };

   const save = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!checkName(values.name)) {
         nameRef.current?.focus();
         return;
      }

      const trimmedName = values.name.trim();
      const description = values.description.trim();
      const accessNotes = values.accessNotes.trim();

      const payload = {
         name: trimmedName,
         description: description || null,
         latitude: position ? position.lat : null,
         longitude: position ? position.lng : null,
         waterType: values.waterType || null,
         accessNotes: accessNotes || null,
      };

      try {
         setIsSaving(true);

         if (siteId) {
            /* TODO(api): spot photos after logging, appendix E item 6. The update
               route takes no images, so the picker stays on the add form. */
            await axios.put(`/api/sites/${siteId}`, payload);
            toast({
               title: 'Spot saved.',
               description: `${trimmedName} is up to date.`,
               variant: 'success',
            });
            navigate(`/sites/${siteId}`, { replace: true });
            return;
         }

         const { data } = await axios.post('/api/sites', {
            ...payload,
            images,
         });
         toast({
            title: 'Spot saved.',
            description: `${trimmedName} is in your spots.`,
            variant: 'success',
         });
         navigate(`/sites/${data.site.id}`, { replace: true });
      } catch (error) {
         console.error(error);
         const refused = refusedFields(error);

         if (Object.keys(refused).length) {
            setErrors(refused);
            if (refused.name) {
               nameRef.current?.focus();
            }
            return;
         }

         toast({
            title: 'Not saved.',
            description: 'The spot did not reach us. Try again.',
            variant: 'error',
         });
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <form
         ref={formRef}
         onSubmit={save}
         noValidate
         className="grid max-w-[680px] gap-10"
      >
         <Group title="The spot">
            <TextField
               ref={nameRef}
               label="Name"
               value={values.name}
               maxLength={NAME_MAX}
               autoComplete="off"
               error={errors.name}
               hint={
                  values.name.length
                     ? `${values.name.length} / ${NAME_MAX}`
                     : undefined
               }
               onChange={(event) => {
                  clearError('name');
                  change('name', event.target.value);
               }}
               onBlur={(event) => checkName(event.target.value)}
            />

            <ChoiceGroup
               label="Water"
               value={values.waterType}
               options={WATER_TYPES.map((water) => ({
                  value: water.value,
                  label: water.word,
               }))}
               onChange={(next) => change('waterType', next)}
            />
         </Group>

         <Group title="Where it is">
            <MapLocationPicker
               latitude={values.latitude}
               longitude={values.longitude}
               onChange={setCoordinates}
            />
            {errors.position ? (
               <p className="text-[15px] text-destructive">{errors.position}</p>
            ) : null}
         </Group>

         <Group title="What it is like">
            <TextArea
               label="Description"
               rows={5}
               value={values.description}
               maxLength={DESCRIPTION_MAX}
               error={errors.description}
               hint={
                  values.description.length
                     ? `${values.description.length} / ${DESCRIPTION_MAX}`
                     : 'What the ground is like, what it fishes for, when it works.'
               }
               onChange={(event) => {
                  clearError('description');
                  change('description', event.target.value);
               }}
            />

            <TextArea
               label="Getting there"
               rows={4}
               value={values.accessNotes}
               maxLength={ACCESS_NOTES_MAX}
               error={errors.accessNotes}
               hint={
                  values.accessNotes.length
                     ? `${values.accessNotes.length} / ${ACCESS_NOTES_MAX}`
                     : 'Where to park and how to get down.'
               }
               onChange={(event) => {
                  clearError('accessNotes');
                  change('accessNotes', event.target.value);
               }}
            />
         </Group>

         <Group title="Photos">
            {isEditing ? (
               <p className="text-[15px] text-ink-2">
                  Photos are set when a spot is added. They cannot be changed
                  here yet.
               </p>
            ) : (
               <R2ImagePicker
                  scope="site"
                  label="Photos of this spot"
                  multiple
                  maxItems={12}
                  value={images}
                  onChange={setImages}
               />
            )}
         </Group>

         {/* TODO(api): a per-spot privacy switch, and a position shown exact,
             at about 1 km, or hidden, appendix E item 8. */}
         <div className="grid gap-5">
            <p className="max-w-[56ch] text-[15px] text-ink-2">
               {position
                  ? 'When you save, this spot appears in the public feed with its position.'
                  : 'When you save, this spot appears in the public feed. No position is recorded yet.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
               <Button type="submit" size="lg" disabled={isSaving}>
                  {isEditing ? 'Save changes' : 'Save spot'}
               </Button>
               <Button variant="ghost" size="lg" asChild>
                  <Link to={siteId ? `/sites/${siteId}` : '/sites/me'}>
                     Cancel
                  </Link>
               </Button>
            </div>
         </div>
      </form>
   );
}

export function LogSitePage() {
   useDocumentTitle('Add a spot');

   return (
      <RequireSignIn what="your spots">
         <section className="mx-auto w-[min(720px,100%-32px)] py-10 md:py-14">
            <h1 className="g text-[44px] md:text-[56px]">Add a spot</h1>
            <p className="mt-3 max-w-[52ch] text-ink-2">
               Name the water, put the pin where you fish, and say how to get
               there. You can log a catch here afterwards.
            </p>
            <div className="mt-10">
               <SpotForm />
            </div>
         </section>
      </RequireSignIn>
   );
}
