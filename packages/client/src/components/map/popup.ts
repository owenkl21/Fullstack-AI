/*
 * The card that opens on a pin.
 *
 * Built as DOM rather than an HTML string, so a spot named with a bracket
 * or an ampersand cannot break out of it. One shape for every kind of pin:
 * a kicker saying what it is, the name in the display face, a row of facts
 * each with its own mark, and the actions as buttons that look like buttons.
 * The marks are Heroicons outlines and the product's own fish, drawn inline
 * because Leaflet owns this DOM, not React.
 */

export type PopupMark =
   | 'fish'
   | 'calendar'
   | 'user'
   | 'pin'
   | 'water'
   | 'note'
   | 'flag'
   | 'ramp'
   | 'anchor'
   | 'hook'
   | 'parking'
   | 'camera';

const PATHS: Record<PopupMark, string> = {
   fish: 'M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z',
   calendar:
      'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
   user: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.68 0-5.22-.58-7.5-1.63Z',
   pin: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4.5 0c0 7.14-7.5 11.25-7.5 11.25S4.5 17.64 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
   water: 'M3 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0M3 15c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0',
   note: 'M16.86 4.49l1.69-1.69a1.88 1.88 0 1 1 2.65 2.65L10.58 16.07a4.5 4.5 0 0 1-1.9 1.13L6 18l.8-2.68a4.5 4.5 0 0 1 1.13-1.9l8.93-8.93Zm0 0L19.5 7.13M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
   flag: 'M7 20V4M7 5h10l-2.5 3.5L17 12H7',
   ramp: 'M4 17h16M6 17 14 7h4M4 20.5h16',
   anchor: 'M12 8v12M12 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 13a7 7 0 0 0 14 0',
   hook: 'M14 4v7a4 4 0 0 1-8 0V9M11.5 6.5 14 4l2.5 2.5',
   parking: 'M9 19V6h4a3.5 3.5 0 0 1 0 7H9',
   camera:
      'M6.83 6.9a2.25 2.25 0 0 1 1.87-1H9.5l.9-1.35A1.5 1.5 0 0 1 11.65 4h.7a1.5 1.5 0 0 1 1.25.55L14.5 5.9h.8a2.25 2.25 0 0 1 2.25 2.25V17a2.25 2.25 0 0 1-2.25 2.25H6.7A2.25 2.25 0 0 1 4.5 17V8.15c0-.44.13-.87.38-1.24ZM15 12.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

const svg = (mark: PopupMark) => {
   const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
   el.setAttribute('viewBox', '0 0 24 24');
   el.setAttribute('aria-hidden', 'true');
   el.setAttribute('class', 'map-card-mark');
   const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
   path.setAttribute('d', PATHS[mark]);
   el.append(path);
   return el;
};

export type PopupFact = { mark: PopupMark; value: string; quiet?: boolean };

export type PopupAction = {
   label: string;
   onClick: (button: HTMLButtonElement) => void;
   tone?: 'primary' | 'plain' | 'danger';
};

export function popupCard(input: {
   kicker: string;
   title: string;
   facts: PopupFact[];
   /* Small words under the facts: what the spot is known for. */
   tags?: string[];
   actions?: PopupAction[];
   /* A stripe of the spot's own colour down the left. */
   accent?: string;
}) {
   const card = document.createElement('div');
   card.className = 'map-card';
   if (input.accent) card.style.setProperty('--card-accent', input.accent);

   const kicker = document.createElement('p');
   kicker.className = 'map-card-kicker';
   kicker.textContent = input.kicker;

   const title = document.createElement('p');
   title.className = 'map-card-title';
   title.textContent = input.title;

   const facts = document.createElement('ul');
   facts.className = 'map-card-facts';
   for (const fact of input.facts) {
      if (!fact.value) continue;
      const li = document.createElement('li');
      li.className = fact.quiet ? 'map-card-fact quiet' : 'map-card-fact';
      const value = document.createElement('span');
      value.textContent = fact.value;
      li.append(svg(fact.mark), value);
      facts.append(li);
   }

   card.append(kicker, title, facts);

   if (input.tags?.length) {
      const tags = document.createElement('ul');
      tags.className = 'map-card-tags';
      for (const tag of input.tags) {
         const li = document.createElement('li');
         li.textContent = tag;
         tags.append(li);
      }
      card.append(tags);
   }

   if (input.actions?.length) {
      const row = document.createElement('div');
      row.className = 'map-card-actions';
      for (const action of input.actions) {
         const button = document.createElement('button');
         button.type = 'button';
         button.className = `map-card-act ${action.tone ?? 'plain'}`;
         button.textContent = action.label;
         button.addEventListener('click', () => action.onClick(button));
         row.append(button);
      }
      card.append(row);
   }

   return card;
}
