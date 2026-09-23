/*
 * The photographs already committed to this repo, reused across the seed.
 *
 * The research asked for about fifty Unsplash downloads and names a manifest of
 * forty four verified photo ids, but it does not actually carry those ids. They
 * are not invented here: a wrong id downloads either nothing or something
 * nobody has looked at, and committing an unseen image is worse than repeating
 * a seen one. Extending this list is a job for whoever has the real manifest.
 *
 * These are stand-ins. Not these anglers, not necessarily these species, and
 * mostly not this coastline.
 */
export type SeedPhoto = {
   id: string;
   path: string;
   kind: 'catch' | 'spot' | 'gear';
};

export const PHOTOS: SeedPhoto[] = [
   {
      id: 'seed_img_catch_depth',
      path: '/photos/catch-depth.jpg',
      kind: 'catch',
   },
   { id: 'seed_img_catch_line', path: '/photos/catch-line.jpg', kind: 'catch' },
   {
      id: 'seed_img_catch_ocean',
      path: '/photos/catch-ocean.jpg',
      kind: 'catch',
   },
   { id: 'seed_img_dawn_boats', path: '/photos/dawn-boats.jpg', kind: 'spot' },
   {
      id: 'seed_img_spot_rock',
      path: '/photos/spot-rock-ocean.jpg',
      kind: 'spot',
   },
   {
      id: 'seed_img_spot_sunset',
      path: '/photos/spot-sunset-rock.jpg',
      kind: 'spot',
   },
   { id: 'seed_img_gear', path: '/photos/gear-rod-reel.jpg', kind: 'gear' },
];

export const catchPhotos = () => PHOTOS.filter((p) => p.kind === 'catch');
export const spotPhotos = () => PHOTOS.filter((p) => p.kind === 'spot');
