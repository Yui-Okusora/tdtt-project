/** Each style has one verified matching photo per participant count (1–4).
 * The source photos were visually checked for numbers of participants.
 * Only show the photo whose style AND people count match current selection.
 */
export const QUICK_GUIDE = Object.freeze({
  Casual: Object.freeze({1:'assets/guide/casual-1.webp',2:'assets/guide/casual-2.webp',3:'assets/guide/casual-3.webp',4:'assets/guide/casual-4.webp'}),
  Fashion: Object.freeze({1:'assets/guide/fashion-1.webp',2:'assets/guide/fashion-2.webp',3:'assets/guide/fashion-3.webp',4:'assets/guide/fashion-4.webp'}),
  JoJo: Object.freeze({1:'assets/guide/jojo-1.webp',2:'assets/guide/jojo-2.webp',3:'assets/guide/jojo-3.webp',4:'assets/guide/jojo-4.webp'})
});
export function guidePhoto(style,people){return QUICK_GUIDE[style]?.[Number(people)]??null;}
