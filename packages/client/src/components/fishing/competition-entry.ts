import type { UploadedPhoto } from '@/components/fishing/quicklog/PhotoBlock';
import {
   needsMeasurePhoto,
   type Competition,
} from '@/components/social/competitions-api';

/*
 * What entering a catch asks for, as plain functions the two log forms and
 * the entry fields share. Kept out of the component file so the dev server
 * can refresh the components on their own.
 */

export const AREA_SENTENCE =
   'I confirm this catch was made in the eligible area and share this entry with the competition. My exact spot stays private.';

export function measurePhotoTitle(competition: Pick<Competition, 'measure'>) {
   return competition.measure === 'LENGTH'
      ? 'The fish on the tape, figure readable'
      : 'The fish on the scale, figure readable';
}

/** What is missing before a catch can be entered; null when nothing is. */
export function entryProblem(
   competition: Competition,
   measurePhoto: UploadedPhoto | null,
   areaConfirmed: boolean,
   declaredValue: number | null,
   /* The catch photo for the board; every entry carries one. */
   hasHeroPhoto = true
) {
   if (!hasHeroPhoto) {
      return 'Add the photo of the fish first. It is the one that goes on the board.';
   }
   if (needsMeasurePhoto(competition) && !measurePhoto) {
      return competition.measure === 'LENGTH'
         ? 'Add the second photo: the same fish on the tape.'
         : 'Add the second photo: the same fish on the scale.';
   }
   if (
      needsMeasurePhoto(competition) &&
      (declaredValue === null || !(declaredValue > 0))
   ) {
      return competition.measure === 'LENGTH'
         ? 'Type the length off the tape.'
         : 'Type the weight off the scale.';
   }
   if (!areaConfirmed) {
      return 'Tick the sentence about where it was caught.';
   }
   return null;
}
