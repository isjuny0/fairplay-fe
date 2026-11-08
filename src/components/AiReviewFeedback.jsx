import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Download, FileText } from 'lucide-react';
import { downloadDeliverable, getLinkedDeliverable } from '../api/deliverables.js';
import useResource from '../hooks/useResource.js';
import { deliverablePermissions, formatDate } from '../lib/domain.js';
import MarkdownBody from './MarkdownBody.jsx';
import { ErrorNotice, Modal, ResourceState } from './ui.jsx';

const findingLabels = {
  ISSUE: { id: 'ai-review-issues', label: '보완할 점', action: '권장 수정' },
  SUGGESTION: { id: 'ai-review-suggestions', label: '선택 제안', action: '개선 방법' },
};
const limitationsSection = { id: 'ai-review-limitations', label: '확인하지 못한 범위' };

function References({ references = [], sources, onOpenSource }) {
  if (!references.length) return null;
  return <div className="ai-evidence-list" aria-label="피드백 근거">
    {references.map((reference, index) => {
      const source = sources.find((item) => item.deliverableId === reference.deliverableId);
      return <blockquote className="ai-evidence" key={`${reference.deliverableId}-${index}`}>
        <div className="ai-evidence-heading">
          <span>{source?.title || '근거 자료'}{source?.version != null && <small> · 버전 {source.version}</small>}</span>
          <button type="button" className="ai-source-link"
            onClick={() => onOpenSource({ ...source, deliverableId: reference.deliverableId, evidence: reference })}
            aria-label={source?.title ? `${source.title} 보기` : '현재 근거 자료 보기'}>
            {source ? '자료 보기' : '현재 자료 보기'} <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <span className="ai-evidence-kind">{reference.quote ? '원문 인용' : '내용 관찰'}</span>
        <p>{reference.quote || reference.observation}</p>
        {reference.location && <small>{reference.location}</small>}
      </blockquote>;
    })}
  </div>;
}

function FindingSection({ group, sources, onOpenSource }) {
  const { id, label, action, findings } = group;
  return <section id={id} tabIndex={-1} className="ai-review-findings" aria-labelledby={`${id}-heading`}>
    <div className="ai-section-heading"><h3 id={`${id}-heading`}>{label}</h3><span>{findings.length}개</span></div>
    <ol className="ai-finding-list">
      {findings.map((finding, index) => (
        <li key={index}>
          <h4>{finding.title}</h4>
          {finding.description !== finding.title && <p className="ai-finding-description">{finding.description}</p>}
          <div className="ai-finding-action"><strong>{action}</strong><p>{finding.action}</p></div>
          {finding.requirementQuote && <details className="ai-requirement">
            <summary>관련 작업 설명</summary><blockquote>{finding.requirementQuote}</blockquote>
          </details>}
          <References references={finding.references} sources={sources} onOpenSource={onOpenSource} />
        </li>
      ))}
    </ol>
  </section>;
}

function showFeedbackSection(id) {
  const section = document.getElementById(id);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: 'start' });
}

export default function AiReviewFeedback({ review, context }) {
  const [selectedSource, setSelectedSource] = useState(null);
  const sources = review.reviewedSources || [];
  const strengths = review.strengths || [];
  const limitations = review.limitations || [];
  const issues = review.findings.filter((finding) => finding.type === 'ISSUE');
  const suggestions = review.findings.filter((finding) => finding.type === 'SUGGESTION');
  const findingGroups = [
    { ...findingLabels.ISSUE, findings: issues },
    { ...findingLabels.SUGGESTION, findings: suggestions },
  ];
  const overview = [
    ...findingGroups.map(({ id, label, findings }) => ({ id, label, count: findings.length })),
    { ...limitationsSection, count: limitations.length },
  ];
  return <>
    <section className="ai-review-summary" aria-label="핵심 요약">
      <h3>핵심 요약</h3>
      <p>{review.summary}</p>
      <ul className="ai-review-overview" aria-label="피드백 항목 수">
        {overview.map(({ id, label, count }) => <li key={id}>
          {count > 0
            ? <button type="button" onClick={() => showFeedbackSection(id)} aria-controls={id}>{label} {count}</button>
            : <span>{label} {count}</span>}
        </li>)}
      </ul>
      {!issues.length && (
        <p className="ai-review-no-issues">검토한 범위에서 보완할 점을 찾지 못했습니다.</p>
      )}
    </section>
    {findingGroups.filter((group) => group.findings.length > 0).map((group) => (
      <FindingSection key={group.id} group={group} sources={sources} onOpenSource={setSelectedSource} />
    ))}
    {limitations.length > 0 && <section id={limitationsSection.id} tabIndex={-1}
      className="ai-review-limitations" aria-labelledby={`${limitationsSection.id}-heading`}>
      <h3 id={`${limitationsSection.id}-heading`}>{limitationsSection.label}</h3>
      <ul>{limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
    </section>}
    {strengths.length > 0 && <section className="ai-review-strengths" aria-label="유지하면 좋은 점">
      <h3>유지하면 좋은 점</h3>
      <ul className="ai-finding-list">{strengths.map((strength, index) => <li key={index}>
        <p>{strength.message}</p>
        <References references={strength.references} sources={sources} onOpenSource={setSelectedSource} />
      </li>)}</ul>
    </section>}
    {sources.length > 0 && <details className="ai-reviewed-sources">
      <summary>검토한 자료 {sources.length}개</summary>
      <ul>{sources.map((source) => <li key={source.deliverableId}>
        <button type="button" onClick={() => setSelectedSource(source)}>
          <FileText size={16} aria-hidden="true" /><span>{source.title || '제목을 확인할 수 없는 자료'}</span>
          {source.version != null && <small>버전 {source.version}</small>}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </li>)}</ul>
    </details>}
    {!review.isCurrent && !sources.length && review.completedAt == null && <p className="field-help">
      검토 당시 자료명·버전과 완료 시각이 저장되지 않은 결과입니다. 자료를 열면 현재 내용을 표시합니다.
    </p>}
    {selectedSource && <SourcePreview key={`${review.id}:${selectedSource.deliverableId}`}
      source={selectedSource} context={context} onClose={() => setSelectedSource(null)}
      onEdit={context.onEditDeliverable && ((material) => {
        setSelectedSource(null);
        context.onEditDeliverable(material);
      })} />}
  </>;
}

function SourcePreview({ source, context, onClose, onEdit }) {
  const { team, task, user } = context;
  const resource = useResource(
    () => getLinkedDeliverable(team.id, task.id, source.deliverableId),
    [team.id, task.id, source.deliverableId],
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const material = resource.data;
  const evidence = source.evidence;
  const canCopyLocation = (source.type ?? material?.type) === 'FILE' && evidence?.location;
  const canEdit = Boolean(onEdit && material && !resource.loading &&
    task.completionBlockReason !== 'WORK_PERIOD_CLOSED' &&
    deliverablePermissions(material, task, team, user.id).content);
  const copyLocation = async () => {
    try {
      await navigator.clipboard.writeText(evidence.location);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };
  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadDeliverable(material.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = material.file.originalFilename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error); }
    finally { setDownloading(false); }
  };
  return createPortal(<Modal title={source.title || '근거 자료'} onClose={onClose} wide className="ai-source-preview">
    {evidence && <section className="ai-source-evidence" aria-label="검토 당시 근거">
      <h3>검토 당시 근거</h3>
      <div className="ai-source-context">
        <span>{source.version == null ? '검토 당시 버전 정보 없음' : `검토 버전 ${source.version}`}</span>
        <span>{evidence.quote ? '원문 인용' : '내용 관찰'}</span>
      </div>
      <blockquote>{evidence.quote || evidence.observation}</blockquote>
      {evidence.location && <div className="ai-source-location">
        <span>위치 · {evidence.location}</span>
        {canCopyLocation && <button type="button" className="secondary-button" onClick={copyLocation}>근거 위치 복사</button>}
      </div>}
      {copyStatus === 'copied' && <p className="field-help" role="status">근거 위치를 복사했습니다.</p>}
      {copyStatus === 'failed' && <p className="field-help" role="alert">위치를 선택해 복사해 주세요.</p>}
    </section>}
    <ResourceState resource={resource} label="근거 자료">
      {material && <section className="stack" aria-label="현재 자료">
        <div className="ai-source-current-heading">
          <div>
            <h3>현재 자료</h3>
            <div className="ai-source-context"><span>버전 {material.version}</span><span>수정 {formatDate(material.updatedAt)}</span></div>
          </div>
          {canEdit && <button type="button" className="secondary-button" onClick={() => onEdit(material)}>결과물 수정</button>}
        </div>
        {source.version == null ? <p className="notice">검토 당시 버전을 확인할 수 없어 현재 자료를 표시합니다.</p>
          : source.version !== material.version && <p className="notice">검토 당시 버전 {source.version}에서 변경된 자료입니다. 현재 자료(버전 {material.version})를 표시합니다.</p>}
        {material.title !== source.title && <p className="field-help">현재 제목 · {material.title}</p>}
        {material.type === 'TEXT' ? <MarkdownBody>{material.text}</MarkdownBody> : <>
          <p>{material.file?.originalFilename}</p>
          <button type="button" className="secondary-button" disabled={downloading} onClick={download}>
            <Download size={16} aria-hidden="true" />{downloading ? '다운로드 중…' : '현재 파일 다운로드'}
          </button>
          <ErrorNotice error={downloadError} />
        </>}
      </section>}
    </ResourceState>
  </Modal>, document.body);
}
