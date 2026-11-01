/** Photo naming is local metadata. No name is uploaded to an AI service. */
export const PHOTO_TITLE_MAX = 60;
/** Normalize user-provided album names without dropping Vietnamese diacritics. */
export function normalizePhotoTitle(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}
/** Error message for the inline result form. Empty or too-long names cannot be saved. */
export function validatePhotoTitle(value) {
  const text = normalizePhotoTitle(value);
  if (!text) return 'Hãy đặt tên bức ảnh trước khi lưu.';
  if (Array.from(text).length > PHOTO_TITLE_MAX) return `Tên ảnh không được vượt quá ${PHOTO_TITLE_MAX} ký tự.`;
  return '';
}
/** Used only for download filenames; the displayed name stays unchanged. */
export function filenameFromTitle(title, id='', dataUrl='') {
  const base = normalizePhotoTitle(title).replace(/[\/\\:*?"<>|]/g, '-').replace(/[. ]+$/g,'').slice(0,80);
  const mime=/^data:image\/(jpeg|png|webp);/i.exec(String(dataUrl))?.[1]?.toLowerCase();
  const ext=mime==='jpeg'?'jpg':mime||'jpg';
  return `${base || 'PoseXimi_' + String(id).slice(0,8)}.${ext}`;
}
