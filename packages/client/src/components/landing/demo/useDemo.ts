import { useEffect, useRef, useState } from 'react';
import { demoMoment } from './data';

/*
 * The demonstration running inside the phone: one morning at Kalk Bay, from tapping
 * Log to the record assembling itself. Every duration below is the one the prototype
 * measured, and reduced motion collapses all of them to nothing.
 */

export type DemoScreen = 'home' | 'record';
export type LengthUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';
export type DemoToast = { lead: string; rest: string };

const reduced = () =>
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The coordinates appear once the fix is under 30 m, which the easing reaches at 1.36s. */
const COORDS_AT = 1360;
const FIX_MS = 2600;

export function useDemo() {
   const phoneRef = useRef<HTMLDivElement>(null);
   const stripRef = useRef<HTMLDivElement>(null);

   const [screen, setScreen] = useState<DemoScreen>('home');
   const [sheetOpen, setSheetOpen] = useState(false);
   const [fixRunning, setFixRunning] = useState(false);
   const [coordsIn, setCoordsIn] = useState(false);
   const [fixDone, setFixDone] = useState(false);
   const [condsIn, setCondsIn] = useState(0);
   const [hasPhoto, setHasPhoto] = useState(false);
   const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
   const [recordSpecies, setRecordSpecies] = useState('Bass');
   const [lengthUnit, setLengthUnit] = useState<LengthUnit>('cm');
   const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
   const [lengthTaped, setLengthTaped] = useState(false);
   const [weightWeighed, setWeightWeighed] = useState(false);
   const [recordBuilt, setRecordBuilt] = useState(false);
   const [recordToken, setRecordToken] = useState(0);
   const [recordCountMs, setRecordCountMs] = useState(1100);
   const [homeToken, setHomeToken] = useState(0);
   const [toast, setToast] = useState<DemoToast | null>(null);
   const [step, setStep] = useState(0);
   const [newRow, setNewRow] = useState(false);
   const [newRowFresh, setNewRowFresh] = useState(false);
   const [playing, setPlaying] = useState(false);

   const alive = useRef(true);
   const timers = useRef<number[]>([]);
   const fixArmed = useRef(false);
   const recordBuiltRef = useRef(false);
   const newRowRef = useRef(false);
   const speciesRef = useRef('Bass');
   const playingRef = useRef(false);

   useEffect(() => {
      alive.current = true;
      const pending = timers.current;
      return () => {
         alive.current = false;
         pending.forEach(window.clearTimeout);
         pending.length = 0;
      };
   }, []);

   const wait = (ms: number) =>
      new Promise<void>((resolve) => {
         const id = window.setTimeout(resolve, reduced() ? 0 : ms);
         timers.current.push(id);
      });

   const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(
         () => {
            if (alive.current) fn();
         },
         reduced() ? 0 : ms
      );
      timers.current.push(id);
   };

   /* The numbers on the home screen count in the first time the phone comes into view. */
   useEffect(() => {
      const el = phoneRef.current;
      if (!el) return;
      const io = new IntersectionObserver(
         (entries) => {
            if (!entries[0].isIntersecting) return;
            setHomeToken((t) => t + 1);
            io.disconnect();
         },
         { threshold: 0.3 }
      );
      io.observe(el);
      return () => io.disconnect();
   }, []);

   function flash(lead: string, rest: string) {
      setToast({ lead, rest });
      later(() => setToast(null), 4500);
   }

   async function openSheet() {
      setSheetOpen(true);
      setStep(1);
      if (fixArmed.current) return;
      fixArmed.current = true;
      await wait(300);
      if (!alive.current) return;
      setFixRunning(true);
      later(() => setCoordsIn(true), COORDS_AT);
      later(() => setFixDone(true), FIX_MS);
      await wait(700);
      if (!alive.current) return;
      setStep(2);
      for (let line = 1; line <= 4; line++) {
         setCondsIn(line);
         await wait(260);
         if (!alive.current) return;
      }
   }

   function closeSheet() {
      setSheetOpen(false);
   }

   function nothingCaught() {
      closeSheet();
      flash('Blank trip saved.', ' 06:14, Kalk Bay, with conditions.');
   }

   function takePhoto() {
      setHasPhoto(true);
      setStep(3);
   }

   function pickSpecies(chip: string) {
      const named = chip === 'Not sure' ? 'Species not recorded' : chip;
      speciesRef.current = named;
      setSelectedSpecies(chip);
      setRecordSpecies(named);
   }

   async function save() {
      setStep(4);
      closeSheet();
      await wait(380);
      if (!alive.current) return;
      setRecordBuilt(false);
      recordBuiltRef.current = false;
      setScreen('record');
      await wait(120);
      if (!alive.current) return;
      setRecordBuilt(true);
      recordBuiltRef.current = true;
      setRecordCountMs(1100);
      setRecordToken((t) => t + 1);
      flash(
         'Saved.',
         ` ${speciesRef.current}, ${demoMoment.lengthCm} cm, ${demoMoment.time}, ${demoMoment.spot}.`
      );
   }

   function goHome() {
      setStep(0);
      if (recordBuiltRef.current && !newRowRef.current) {
         newRowRef.current = true;
         setNewRow(true);
         setNewRowFresh(true);
         later(() => setNewRowFresh(false), 4000);
      }
      setScreen('home');
   }

   function openRecord() {
      setRecordBuilt(true);
      recordBuiltRef.current = true;
      setScreen('record');
      setRecordCountMs(700);
      setRecordToken((t) => t + 1);
   }

   function seeThoseThree() {
      stripRef.current?.scrollTo({
         left: 220,
         behavior: reduced() ? 'auto' : 'smooth',
      });
   }

   async function play() {
      if (playingRef.current) return;
      playingRef.current = true;
      setPlaying(true);

      const phone = phoneRef.current;
      if (phone) {
         const box = phone.getBoundingClientRect();
         if (box.top < 70 || box.bottom > window.innerHeight) {
            phone.scrollIntoView({
               behavior: reduced() ? 'auto' : 'smooth',
               block: 'center',
            });
         }
      }

      await wait(600);
      if (!alive.current) return;
      setScreen('home');
      setHasPhoto(false);
      await wait(300);
      if (!alive.current) return;

      const first = !fixArmed.current;
      void openSheet();
      await wait(first ? 3400 : 1200);
      if (!alive.current) return;

      takePhoto();
      await wait(1500);
      if (!alive.current) return;

      pickSpecies('Bass');
      await wait(700);
      if (!alive.current) return;

      setLengthTaped(true);
      await wait(600);
      if (!alive.current) return;

      void save();
      await wait(4200);
      if (!alive.current) return;

      goHome();
      await wait(600);
      if (!alive.current) return;
      playingRef.current = false;
      setPlaying(false);
   }

   const demo = {
      screen,
      sheetOpen,
      fixRunning,
      coordsIn,
      fixDone,
      condsIn,
      hasPhoto,
      selectedSpecies,
      recordSpecies,
      lengthUnit,
      weightUnit,
      lengthTaped,
      weightWeighed,
      recordBuilt,
      recordToken,
      recordCountMs,
      homeToken,
      toast,
      step,
      newRow,
      newRowFresh,
      playing,
      openSheet,
      closeSheet,
      nothingCaught,
      takePhoto,
      pickSpecies,
      setLengthUnit,
      setWeightUnit,
      setLengthTaped,
      setWeightWeighed,
      save,
      goHome,
      openRecord,
      seeThoseThree,
      play,
      dismissToast: () => setToast(null),
   };

   return { demo, phoneRef, stripRef };
}

export type Demo = ReturnType<typeof useDemo>['demo'];
