import JSZip from 'jszip';
import { downloadSpaceAnnouncementAttachment } from '../api/spaceAnnouncements.js';

export async function downloadAnnouncementAttachments(spaceId, item, selected) {
  const attachments = Array.isArray(selected) ? selected : [selected];
  if (!attachments.length || attachments.some(file => !file?.id)) {
    throw new Error('다운로드할 첨부파일을 확인해 주세요.');
  }
  const files = await Promise.all(attachments.map(async attachment => ({
    attachment,
    blob: await downloadSpaceAnnouncementAttachment(spaceId, item.id, attachment.id),
  })));
  let blob = files[0].blob;
  let filename = files[0].attachment.originalFilename;
  if (files.length > 1) {
    const archive = new JSZip();
    const usedNames = new Set();
    for (const file of files) {
      const original = (file.attachment.originalFilename || '첨부파일')
        .split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '-');
      const dot = original.lastIndexOf('.');
      const basename = dot > 0 ? original.slice(0, dot) : original;
      const extension = dot > 0 ? original.slice(dot) : '';
      let name = original;
      let suffix = 2;
      while (usedNames.has(name)) name = `${basename} (${suffix++})${extension}`;
      usedNames.add(name);
      archive.file(name, file.blob);
    }
    blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const title = (item.title || '공지').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || '공지';
    filename = `${title}-첨부파일.zip`;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
