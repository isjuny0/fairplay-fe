const samples = {
  pdf: {
    title: '팀 자료 검색 PDF 검증 기록',
    originalFilename: '팀-자료-검색-PDF-검증.pdf',
    contentType: 'application/pdf',
    sizeBytes: 18160,
    assetUrl: new URL('./files/rag-search-checklist.pdf', import.meta.url),
    pages: [
      'PDF 검색 준비\n텍스트가 포함된 PDF를 팀 자료에 등록하고 검색 가능 상태를 확인합니다.',
      'PDF 인용 검증\n답변의 인용을 선택하면 해당 PDF 페이지에서 추출한 문장이 강조됩니다.',
    ],
  },
  docx: {
    title: '팀 자료 검색 Word 검증 기록',
    originalFilename: '팀-자료-검색-Word-검증.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 946,
    assetUrl: new URL('./files/rag-search-checklist.docx', import.meta.url),
    content: 'Word 인용 검증\nDOCX 문서의 본문에서 추출한 텍스트를 팀 자료 검색에 활용합니다.',
  },
};

export function previewRagFile(item) {
  return Object.hasOwn(samples, item.ragSampleFormat) ? samples[item.ragSampleFormat] : undefined;
}

export function previewRagFileMaterials(teamId, authorId, timestamp, firstId) {
  return Object.entries(samples).map(([format, sample], index) => ({
    id: firstId + index,
    teamId,
    taskId: null,
    title: sample.title,
    type: 'FILE',
    ragSampleFormat: format,
    version: 1,
    file: {
      originalFilename: sample.originalFilename,
      contentType: sample.contentType,
      sizeBytes: sample.sizeBytes,
    },
    authorId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
