/*
 * The Privacy Policy and the Terms, as data.
 *
 * Written from the code rather than from a template: every service named here
 * is one the app actually calls, and every promise is one it actually keeps.
 * If a feature changes what is collected or who it goes to, this changes in
 * the same commit, and the version below moves so that anyone who agreed to
 * the old words is asked again.
 *
 * Plain words on purpose. A policy nobody can read has not told anybody
 * anything, whatever it says.
 */

/** The date these words took effect. Agreeing is recorded against it. */
export const LEGAL_VERSION = '2026-09-21';
export const LEGAL_UPDATED = '21 September 2026';
export const CONTACT_EMAIL = 'info@fisherfeed.com';

export type LegalBlock = string | { list: string[] };
export type LegalSection = {
   id: string;
   heading: string;
   blocks: LegalBlock[];
};
export type LegalDoc = {
   title: string;
   lead: string;
   sections: LegalSection[];
};

export const privacyPolicy: LegalDoc = {
   title: 'Privacy Policy',
   lead: 'What Fisherfeed keeps about you, what it does with it, who else sees it, and what you can ask for. It is written to meet the Protection of Personal Information Act (POPIA).',
   sections: [
      {
         id: 'who',
         heading: 'Who we are',
         blocks: [
            'Fisherfeed is a fishing log for the South African coast and its dams, at fisherfeed.com. In this policy "we" and "us" mean Fisherfeed, which is the responsible party for your personal information under POPIA.',
            `Our information officer can be reached at ${CONTACT_EMAIL}. Write to that address for anything in this policy.`,
         ],
      },
      {
         id: 'collect',
         heading: 'What we collect',
         blocks: [
            'What you give us when you make an account:',
            {
               list: [
                  'Your name, email address and handle.',
                  'Your password, which we store only as a one way hash. Nobody at Fisherfeed can read it.',
                  'If you add them: a profile picture, a banner, a short bio and the units you prefer.',
               ],
            },
            'What you log:',
            {
               list: [
                  'Catches: the time, the position, the species, length, weight and how each was measured, depth, method, whether the fish was released, your notes and your photographs.',
                  'The conditions at the time of a catch, which we look up for you: wind, pressure, air and sea temperature, swell, tide and moon.',
                  'Spots, private marks, gear, and anything you save.',
                  'Ratings, reviews, comments, likes, follows, groups and competition entries.',
               ],
            },
            'What the service records on its own:',
            {
               list: [
                  'When you sign in, the IP address and browser your session came from, kept with that session.',
                  'A sign in cookie, described under Cookies below.',
               ],
            },
            'We do not collect your date of birth, phone number, contacts or payment details, and we do not run advertising or analytics trackers.',
         ],
      },
      {
         id: 'photos',
         heading: 'Your photographs and what is inside them',
         blocks: [
            'A phone writes the time, and often the exact place, a photograph was taken into the file itself. We keep your original photograph exactly as you uploaded it, with that information inside, and we read the time and place from it to fill in your catch for you.',
            'Only you are ever given your original. Everyone else who views your photograph gets a resized copy that carries no time, place or camera information. When a copy of your photograph is sent to a service that works on it for us, such as species identification, the location is taken out first.',
            'Some phones and browsers remove the location from a photograph before it reaches us. When that happens we cannot get it back, and the catch uses the position from your phone at the time you log it instead.',
         ],
      },
      {
         id: 'use',
         heading: 'How we use it',
         blocks: [
            {
               list: [
                  'To run your log: saving your catches, spots and marks and showing them back to you.',
                  'To show what you choose to share, to the people you choose, following your visibility and location settings.',
                  'To look up forecasts, tides and conditions for a place and time.',
                  'To name the fish in a photograph, and to read a length or a weight off a measuring board or scale in a competition photo.',
                  'To run boards, groups and competitions, including checking that the same fish is not entered twice.',
                  'To send you account email: confirming your address, resetting your password, and telling you when your password or address has changed. We do not send marketing email.',
                  'To keep the service secure, stop abuse, and fix what breaks.',
                  'To improve Fisherfeed, including training our models as set out below.',
               ],
            },
         ],
      },
      {
         id: 'training',
         heading: 'Training our models',
         blocks: [
            'Fisherfeed learns from the catches it is given. When you save a catch with a photograph and a species, including a private catch, we use it to train and improve our species identification model:',
            {
               list: [
                  'The photograph, with its location taken out.',
                  'The species you settled on, which is the label the model learns from.',
                  'The catch and your account identifier, so that an example can be traced and removed if you ask.',
               ],
            },
            'The model keeps a numerical fingerprint of each fish it is shown, and uses those fingerprints to recognise species and to spot the same fish entered twice in a competition.',
            'We also use what is logged, such as species, sizes, times and conditions, to build and improve features like forecasts, ratings and insights. Where this goes beyond your own log it is combined across many catches, and nothing that identifies you or reveals a private position is shown to anyone else.',
            'By creating an account you agree to this use. You can ask us to remove your photographs from the training set at any time by writing to us. Something a model has already learned from a photograph cannot always be fully undone, but we will remove the photograph and its fingerprint and stop using it.',
         ],
      },
      {
         id: 'share',
         heading: 'Who else receives it',
         blocks: [
            'We do not sell your personal information, and we do not share it with advertisers. We use these service providers to run Fisherfeed, and they handle only what their part of the job needs:',
            {
               list: [
                  'Vercel, which serves the website. Every request to Fisherfeed passes through it.',
                  'Railway, which runs our servers and database.',
                  'Cloudflare R2, which stores your photographs.',
                  'Resend, which sends our account email.',
                  'Anthropic, whose Claude model reads a length or weight off a competition photo.',
                  'Open-Meteo and Apple WeatherKit, which are sent a position and a time to return the weather.',
                  'OpenStreetMap services (Nominatim, Photon and Overpass), which are sent a search or a position to return place names, slipways and shops.',
                  'Esri, OpenStreetMap, OpenTopoMap and OpenSeaMap, which draw the maps. Your browser asks them for map tiles directly, so they see your IP address and the area you are looking at.',
                  'Google Maps, only when you choose to open a position in Google Maps.',
               ],
            },
            'Other anglers see only what you share. Your public profile shows your name, handle, bio, pictures and how many people follow you. Your catches and spots are shown according to the visibility you set on each one. A catch with its location hidden shows no position to anyone but you, and your private marks are never shown to anyone.',
            'We may disclose information if the law requires it, or to protect someone from harm.',
         ],
      },
      {
         id: 'abroad',
         heading: 'Information stored outside South Africa',
         blocks: [
            'Several of the providers above store or process information outside South Africa, mainly in the United States and Europe. We use providers that are bound to protect it to a standard comparable to POPIA. By using Fisherfeed you agree to this transfer.',
         ],
      },
      {
         id: 'keep',
         heading: 'How long we keep it',
         blocks: [
            'We keep your account and your log for as long as your account exists. When you delete a catch, a spot or a mark it disappears from the app straight away, but the record and its photographs stay in our storage until your account is deleted.',
            `To delete your account and everything in it, write to ${CONTACT_EMAIL} from the address on the account. We will delete it within 30 days and confirm when it is done. Some records may stay in backups for a short time after that, and anything we are required by law to keep will be kept only as long as required.`,
         ],
      },
      {
         id: 'rights',
         heading: 'Your rights',
         blocks: [
            'Under POPIA you may:',
            {
               list: [
                  'Ask what personal information we hold about you, and for a copy of it.',
                  'Ask us to correct anything that is wrong. Most of it you can change yourself in your profile and account.',
                  'Ask us to delete your information, or object to how we use it, including its use for training.',
                  'Withdraw your consent. This will not affect what was done before, and some of the service may no longer work without it.',
                  'Complain to the Information Regulator of South Africa at inforegulator.org.za if you think we have not handled your information properly.',
               ],
            },
            `Write to ${CONTACT_EMAIL} and we will answer within 30 days.`,
         ],
      },
      {
         id: 'security',
         heading: 'How we protect it',
         blocks: [
            'Everything travels over encrypted connections. Passwords are hashed. Photographs are stored privately and every link to one expires after a few minutes. Only your own session can reach your originals and your private marks. No system is perfectly secure, and if a breach affects your information we will tell you and the Information Regulator as POPIA requires.',
         ],
      },
      {
         id: 'cookies',
         heading: 'Cookies and your device',
         blocks: [
            'We use one cookie, which keeps you signed in. It cannot be read by scripts on the page, and it lasts up to seven days. We use no advertising or tracking cookies.',
            'The app also keeps a few things in your browser so it works the way you left it: your light or dark theme, your units, your last known position, and catches you have started but not yet saved. They stay on your device, and clearing your browser data removes them.',
         ],
      },
      {
         id: 'children',
         heading: 'Children',
         blocks: [
            'Fisherfeed is for people aged 18 and over, or younger anglers using it with the consent of a parent or guardian. If you believe a child has given us information without that consent, write to us and we will delete it.',
         ],
      },
      {
         id: 'changes',
         heading: 'Changes to this policy',
         blocks: [
            'When this policy changes we will update the date at the top. If a change affects how your information is used, we will ask you to agree again the next time you sign in.',
         ],
      },
   ],
};

export const terms: LegalDoc = {
   title: 'Terms and Conditions',
   lead: 'The agreement between you and Fisherfeed. By creating an account, or by using Fisherfeed, you agree to these terms and to the Privacy Policy.',
   sections: [
      {
         id: 'agreement',
         heading: 'The agreement',
         blocks: [
            'These terms apply to fisherfeed.com and everything on it. If you do not agree to them, do not create an account or use the service. The Privacy Policy is part of these terms.',
         ],
      },
      {
         id: 'who-can',
         heading: 'Who can use Fisherfeed',
         blocks: [
            'You must be 18 or older, or have the consent of a parent or guardian who agrees to these terms for you.',
         ],
      },
      {
         id: 'account',
         heading: 'Your account',
         blocks: [
            {
               list: [
                  'Give a real email address that you can receive mail at, and keep your password to yourself. You are responsible for what happens under your account.',
                  'One person, one account. Do not sign up as someone else.',
                  'Your handle must be your own. Handles are unique, and we may take back a handle that impersonates someone, misleads, or is offensive.',
                  'Tell us straight away if you think someone else has got into your account.',
               ],
            },
         ],
      },
      {
         id: 'content',
         heading: 'Your photographs and your log',
         blocks: [
            'What you post stays yours. You keep the rights to your photographs, your catches and everything else you add.',
            'So that we can run the service, you give Fisherfeed a worldwide, non-exclusive, royalty free licence to store, copy, resize, process and display what you add, in the ways your settings allow. You also give us permission to use your photographs, species and catch records to train and improve our models, as set out in the Privacy Policy. This licence ends when you delete your content or your account, except for what a model has already learned, which cannot always be undone.',
            'Only post photographs you took, or have the right to post, and nothing of anyone who has not agreed to be in it.',
         ],
      },
      {
         id: 'conduct',
         heading: 'How to behave',
         blocks: [
            'Do not use Fisherfeed to:',
            {
               list: [
                  'Break the law, including fishing law: permits, size and bag limits, closed seasons and marine protected areas.',
                  'Harass, threaten or abuse anyone, or post anything hateful, sexual, or violent.',
                  "Reveal someone else's private mark, or anyone's personal information, without their permission.",
                  'Post false catches or false measurements, especially in a competition.',
                  'Copy, scrape or harvest content or data, or access the service with bots or automated tools.',
                  'Try to get around a privacy setting, break into an account, or interfere with how the service runs.',
               ],
            },
            'We may remove content or suspend or close an account that breaks these rules, and in serious cases we may report it.',
         ],
      },
      {
         id: 'safety',
         heading: 'Fishing, the sea and your safety',
         blocks: [
            'Forecasts, tides, ratings, conditions, species names and measurements in Fisherfeed are estimates. They come from models and from other services and can be wrong. Never rely on them for your safety.',
            'Rock and surf fishing is dangerous. Waves, tides and weather change without warning. You are responsible for your own safety, for judging whether it is safe to fish, and for following the law. Check the official forecast and warnings before you go.',
         ],
      },
      {
         id: 'competitions',
         heading: 'Groups and competitions',
         blocks: [
            'Groups and competitions are run by the anglers who create them, and they are responsible for their own rules and prizes. Fisherfeed provides the tools, such as boards and measurement reading, but does not run, judge or guarantee any competition.',
         ],
      },
      {
         id: 'service',
         heading: 'The service',
         blocks: [
            'Fisherfeed is free. We are always working on it, so features may change, and we may pause or stop the service. We will give reasonable notice before closing it and a way to get your log out.',
         ],
      },
      {
         id: 'liability',
         heading: 'Liability',
         blocks: [
            'Fisherfeed is provided as it is. As far as the law allows, we are not liable for any loss, injury or damage that comes from using the service or relying on anything in it, including forecasts, conditions and positions. Nothing in these terms limits any right you have under the Consumer Protection Act that cannot be limited.',
         ],
      },
      {
         id: 'ending',
         heading: 'Ending the agreement',
         blocks: [
            `You can stop using Fisherfeed at any time, and ask us to delete your account by writing to ${CONTACT_EMAIL}. We may close an account that breaks these terms.`,
         ],
      },
      {
         id: 'law',
         heading: 'The law that applies',
         blocks: [
            'These terms are governed by the law of the Republic of South Africa, and its courts deal with any dispute.',
         ],
      },
      {
         id: 'changes',
         heading: 'Changes to these terms',
         blocks: [
            'When these terms change we will update the date at the top. If the change is significant we will ask you to agree again the next time you sign in. If you keep using Fisherfeed after that, you accept the new terms.',
         ],
      },
      {
         id: 'contact',
         heading: 'Contact',
         blocks: [`Questions about these terms go to ${CONTACT_EMAIL}.`],
      },
   ],
};
