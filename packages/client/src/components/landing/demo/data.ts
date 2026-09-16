import { photos } from '../photos';

/*
 * Sample data for the demonstration inside the phone. None of it is fetched and none
 * of it is a real angler's; it is the same morning at Kalk Bay every time.
 */

export const demoMoment = {
   date: 'Tue 15 Sep',
   time: '06:14',
   spot: 'Kalk Bay',
   coords: '-34.12770, 18.44860',
   photo: photos.catchOcean,
   lengthCm: '44',
   lengthIn: '17.3',
   weightKg: '1.9',
   weightLb: '4.2',
};

export const nowScreen = {
   stamp: 'Tue 15 Sep · 06:12',
   sunrise: 'Sunrise in 6 min',
   summary: 'Falling glass, south-west blow',
   spot: 'Kalk Bay',
   photo: photos.rockOcean,
   photoAlt: 'Rocks at Kalk Bay',
};

export const readouts = [
   {
      key: 'Wind',
      to: 24,
      decimals: 0,
      unit: 'km/h',
      note: 'SW, gusts 38',
      teal: false,
   },
   {
      key: 'Pressure',
      to: 1013,
      decimals: 0,
      unit: 'hPa',
      note: 'Down 6 since last trip',
      teal: true,
   },
   {
      key: 'Air',
      to: 11,
      decimals: 0,
      unit: '°C',
      note: 'Clear, rain later',
      teal: false,
   },
] as const;

export const logSays = {
   label: 'What your log says',
   body: 'Three of your five kob here came on a falling glass after a south-west blow, between 05:50 and 07:10.',
   link: 'See those three',
};

export const seasonHeading = {
   title: 'This season',
   count: '12 catches · 3 blank',
};
export const recentHeading = { title: 'Recent', count: 'All 184' };

export type SeasonMark =
   | {
        kind: 'catch';
        photo: string;
        height: number;
        size: string;
        when: string;
     }
   | { kind: 'blank' };

export const season: SeasonMark[] = [
   {
      kind: 'catch',
      photo: photos.catchLine,
      height: 108,
      size: '24 cm',
      when: '16 Aug · Rooi-Els',
   },
   { kind: 'blank' },
   {
      kind: 'catch',
      photo: photos.catchDepth,
      height: 146,
      size: '31 cm',
      when: '22 Aug · Lakenvlei',
   },
   {
      kind: 'catch',
      photo: photos.catchOcean,
      height: 164,
      size: '44 cm',
      when: '5 Sep · Theewaterskloof',
   },
   { kind: 'blank' },
   { kind: 'blank' },
   {
      kind: 'catch',
      photo: photos.catchLine,
      height: 126,
      size: '27 cm',
      when: '12 Sep · Kalk Bay',
   },
   {
      kind: 'catch',
      photo: photos.catchOcean,
      height: 178,
      size: '52 cm',
      when: '14 Sep · Theewaterskloof',
   },
];

export type RecentRow = {
   id: string;
   photo?: string;
   title: string;
   meta: string;
   size?: string;
   blank?: boolean;
};

export const recent: RecentRow[] = [
   {
      id: 'bass-14-sep',
      photo: photos.catchOcean,
      title: 'Bass',
      meta: 'Sun 14 Sep, 06:40 · Theewaterskloof',
      size: '52 cm',
   },
   {
      id: 'steenbras-12-sep',
      photo: photos.catchLine,
      title: 'Steenbras',
      meta: 'Sat 12 Sep, 07:05 · Kalk Bay',
      size: '27 cm',
   },
   {
      id: 'blank-12-sep',
      title: 'Blank trip',
      meta: 'Sat 12 Sep, 05:20 · Kalk Bay · SW 31 km/h',
      blank: true,
   },
];

export const conditionLines = [
   { key: 'Wind', value: 'SW 24 km/h, gusting 38' },
   { key: 'Pressure', value: '1013 hPa, falling' },
   { key: 'Air', value: '11 °C, clear' },
] as const;

export const conditionsNote =
   'Conditions taken 06:14. You can put the phone away now.';
export const receiptNote = 'Stamped the moment you tapped Log.';

export const speciesChips = [
   'Kob',
   'Bass',
   'Elf',
   'Galjoen',
   'Not sure',
] as const;

export const recordCells = [
   { key: 'Length', under: '17.3 in · ', source: 'on a tape' },
   { key: 'Weight', under: '4 lb 3 oz · ', source: 'by eye' },
] as const;

export const recordConditions = {
   key: 'Conditions 06:14',
   value: 'SW 24 km/h · 1013 hPa',
   under: 'falling 6 · 11 °C, clear',
};

export const recordPosition = {
   key: 'Position',
   value: '-34.12770, 18.44860',
   underBefore: 'live fix ',
   underBold: '±8 m',
   underAfter: ' · Kalk Bay',
};

export const recordProvenance =
   'Weight by eye. Position from a live fix, ±8 m. Conditions taken 2 minutes after the catch from a forecast point 4.2 km away. Source: Includes weather data from Google.';

export const steps = [
   {
      n: '01',
      title: 'Tap Log',
      body: 'The clock is stamped and the fix starts tightening from ±120 m before the sheet has opened.',
   },
   {
      n: '02',
      title: 'Conditions arrive',
      body: 'Wind, pressure and air land one line at a time. You can put the phone away now.',
   },
   {
      n: '03',
      title: 'Take the photo',
      body: 'A shutter, then the fish. Species and size take three taps; anything left alone is recorded by eye.',
   },
   {
      n: '04',
      title: 'Save',
      body: 'The record assembles around the photo: the numbers settle into place and the row lands at the top of your log.',
   },
] as const;
