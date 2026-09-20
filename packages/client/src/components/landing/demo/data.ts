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

/*
 * The second row the app's home screen carries under the three big readings:
 * sky, sea and swell, stated rather than counted up.
 */
export const readoutsRow2 = [
   { key: 'Sky', value: 'Clear' },
   { key: 'Water', value: '16.4 \u00b0C' },
   { key: 'Swell', value: '2.4 m at 11 s' },
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
   'Weight by eye. Position from a live fix, ±8 m. Conditions taken 2 minutes after the catch from a forecast point 4.2 km away. Weather data by Open-Meteo.com';

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

/*
 * The feed, the log, the map and a board, as the four screens the phone's bar
 * switches between. Same morning at Kalk Bay, same sample angler, and the copy
 * is the copy the page was designed from.
 */

export const feedHead = { kicker: 'Newest first', title: 'Feed' };

export const feedPost = {
   author: 'Riaan Adams',
   handle: 'riaanadams',
   initial: 'R',
   photo: photos.catchOcean,
   photoAlt: 'A bass held over the water at Kalk Bay',
   frame: '1 / 3',
   species: 'Bass',
   measure: '44 cm · 1.9 kg',
   source: 'by eye',
   context: 'Caught at Kalk Bay, Tue 15 Sep, 06:14 · 4 h ago',
   note: 'Falling glass after the south-west blow. Second cast, off the ledge.',
   likes: 18,
   comments: 4,
   action: 'See the catch',
};

export const catchesHead = {
   kicker: 'Your log',
   title: 'My catches',
   heading: 'Recent',
   count: 'All 184 catches',
   /* The line the log closes on once a list is longer than the page. */
   more: 'Showing 4 of 184 catches',
};

export type CatchesRow = {
   id: string;
   photo: string;
   species: string;
   when: string;
   spot: string;
   length: string;
};

export const catchesRows: CatchesRow[] = [
   {
      id: 'bass-15-sep',
      photo: photos.catchOcean,
      species: 'Bass',
      when: 'Tue 15 Sep, 06:14',
      spot: 'Kalk Bay',
      length: '44 cm',
   },
   {
      id: 'bass-14-sep',
      photo: photos.catchDepth,
      species: 'Bass',
      when: 'Sun 14 Sep, 06:40',
      spot: 'Theewaterskloof',
      length: '52 cm',
   },
   {
      id: 'steenbras-12-sep',
      photo: photos.catchLine,
      species: 'Steenbras',
      when: 'Sat 12 Sep, 07:05',
      spot: 'Kalk Bay',
      length: '27 cm',
   },
   {
      id: 'galjoen-11-sep',
      photo: photos.catchOcean,
      species: 'Galjoen',
      when: 'Fri 11 Sep, 17:20',
      spot: 'Rooi-Els',
      length: '38 cm',
   },
];

/* The water the phone opens on, closer in than the page's own map. */
export const mapCentre = { lat: -34.1295, lng: 18.4477 };
export const mapZoom = 14;

export type MapMark = {
   key: string;
   kind: 'spot' | 'other' | 'waypoint' | 'ramp' | 'tackle';
   lat: number;
   lng: number;
   count?: number;
};

/*
 * Where each mark stands is checked against the imagery underneath it. The
 * coast runs down about 18.449 here, so a spot or a private mark west of that
 * would be pinned up the mountain behind Kalk Bay; the slipway belongs in the
 * harbour and the tackle shop in the village, which is where they are.
 */
export const mapMarks: MapMark[] = [
   { key: 'kalk', kind: 'spot', lat: -34.129, lng: 18.452, count: 12 },
   { key: 'ledge', kind: 'spot', lat: -34.1352, lng: 18.4548, count: 3 },
   { key: 'theirs', kind: 'other', lat: -34.1215, lng: 18.4585 },
   { key: 'mark', kind: 'waypoint', lat: -34.131, lng: 18.4585 },
   { key: 'ramp', kind: 'ramp', lat: -34.1262, lng: 18.449 },
   { key: 'tackle', kind: 'tackle', lat: -34.1301, lng: 18.4405 },
];

export const boardsHead = {
   kicker: 'Boards',
   title: 'Who is catching what',
   /* The way through to competitions on a phone, as the board carries it. */
   competitions: 'Competitions anglers are running',
};

export const board = {
   species: 'Galjoen',
   order: 'By length',
   head: 'Longest',
   rows: [
      { pos: '1', name: 'R. Adams', spot: 'Cape Point', value: '61 cm' },
      { pos: '2', name: 'T. Naidoo', spot: 'Rooi-Els', value: '58 cm' },
      { pos: '3', name: 'You', spot: 'Kalk Bay', value: '54 cm', you: true },
   ],
} as const;
