import { useState } from 'react';
import { ChevronRight, Download, FileText } from 'lucide-react';
import { downloadDeliverable, findTaskDeliverable } from '../api/deliverables.js';
import useResource from '../hooks/useResource.js';
import { deliverablePermissions, formatDate } from '../lib/domain.js';
import MarkdownBody from './MarkdownBody.jsx';
import { ErrorNotice, Modal, ResourceState } from './ui.jsx';

const findingLabels = {
  ISSUE: { id: 'ai-review-issues', label: '보완할 점', action: '권장 수정' },
  SUGGESTION: { id: 'ai-review-suggestions', label: '선택 제안', action: '개선 방법' },
};

function References({ references = [], sources, onOpenSource }) {
  if (!references.length) return null;
  return <div className="ai-evidence-list" aria-label="피드백 근거">
    {references.map((reference, index) => {
      const source = sources.find((item) => item.deliverableId === reference.deliverableId);
      return <div className="ai-evidence" key={`${reference.deliverableId}-${index}`}>
        <div className="ai-evidence-heading">
          <span><FileText size={15} aria-hidden="true" />{source?.title || '근거 자료'}</span>
          <button type="button" className="ai-source-link"
            onClick={() => onOpenSource(source || { deliverableId: reference.deliverableId, title: null, version: null })}
            aria-label={source?.title ? `${source.title} 보기` : '현재 근거 자료 보기'}>
            {source ? '자료 보기' : '현재 자료 보기'} <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="ai-evidence-detail">
          <div className="ai-detail-label">{reference.quote ? '원문 인용' : '내용 관찰'}</div>
          {reference.quote
            ? <blockquote>{reference.quote}</blockquote>
            : <p>{reference.observation}</p>}
          {reference.location && <small>{reference.location}</small>}
        </div>
      </div>;
    })}
  </div>;
}

function FindingSection({ group, findings, sources, onOpenSource }) {
  return <section id={group.id} tabIndex={-1} className="ai-review-findings" aria-labelledby={`${group.id}-heading`}>
    <div className="ai-section-heading">
      <h3 id={`${group.id}-heading`}>{group.label}</h3><span>{findings.length}개</span>
    </div>
    <ol className="ai-finding-list">
      {findings.map((finding, index) => {
        const description = finding.description?.trim();
        const showDescription = description && ![finding.title?.trim(), finding.action?.trim()].includes(description);
        return <li key={index}>
          <h4>{finding.title}</h4>
          <div className="ai-finding-action"><strong>{group.action}</strong><p>{finding.action}</p></div>
          {showDescription && <p className="ai-finding-description">{description}</p>}
          {finding.requirementQuote && <div className="ai-requirement">
            <div className="ai-detail-label">관련 작업 설명</div>
            <blockquote>{finding.requirementQuote}</blockquote>
          </div>}
          <References references={finding.references} sources={sources} onOpenSource={onOpenSource} />
        </li>;
      })}
    </ol>
  </section>;
}

function showFeedbackSection(id) {
  const section = document.getElementById(id);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: 'start' });
}

export default function AiReviewFeedback({ review, context, onEditSource }) {
  const [selectedSource, setSelectedSource] = useState(null);
  const sources = review.reviewedSources || [];
  const strengths = review.strengths || [];
  const limitations = review.limitations || [];
  const issues = review.findings.filter((finding) => finding.type === 'ISSUE');
  const suggestions = review.findings.filter((finding) => finding.type === 'SUGGESTION');
  const otherFindings = review.findings.filter((finding) => !Object.hasOwn(findingLabels, finding.type));
  return <>
    <section className="ai-review-summary" aria-label="핵심 요약">
      <h3>핵심 요약</h3>
      <p>{review.summary}</p>
      <ul className="ai-review-overview" aria-label="피드백 항목 수">
        {[[findingLabels.ISSUE, issues.length], [findingLabels.SUGGESTION, suggestions.length]].map(([{ id, label }, count]) => <li key={id}>
          {count > 0
            ? <button type="button" onClick={() => showFeedbackSection(id)} aria-controls={id}>{label} {count}</button>
            : <span>{label} {count}</span>}
        </li>)}
      </ul>
      {!issues.length && !otherFindings.length && <p className="ai-review-no-issues">검토한 범위에서 보완할 점을 찾지 못했습니다.</p>}
    </section>
    {issues.length > 0 && <FindingSection group={findingLabels.ISSUE} findings={issues} sources={sources} onOpenSource={setSelectedSource} />}
    {suggestions.length > 0 && <FindingSection group={findingLabels.SUGGESTION} findings={suggestions} sources={sources} onOpenSource={setSelectedSource} />}
    {otherFindings.length > 0 && <FindingSection group={{ id: 'ai-review-other-findings', label: '기타 피드백', action: '권장 행동' }}
      findings={otherFindings} sources={sources} onOpenSource={setSelectedSource} />}
    {strengths.length > 0 && <section className="ai-review-strengths" aria-label="유지하면 좋은 점">
      <h3>유지하면 좋은 점</h3>
      <ul className="ai-finding-list">{strengths.map((strength, index) => <li key={index}>
        <p>{strength.message}</p>
        <References references={strength.references} sources={sources} onOpenSource={setSelectedSource} />
      </li>)}</ul>
    </section>}
    {(limitations.length > 0 || sources.length > 0) && <section className="ai-review-scope" aria-labelledby="ai-review-scope-heading">
      <h3 id="ai-review-scope-heading">검토 범위</h3>
      {limitations.length > 0 && <section className="ai-review-limitations" aria-label="확인하지 못한 범위">
        <h4>확인하지 못한 범위</h4>
        <ul>{limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
      </section>}
      {sources.length > 0 && <section className="ai-reviewed-sources">
        <h4>검토한 자료 {sources.length}개</h4>
        <ul>{sources.map((source) => <li key={source.deliverableId}>
          <button type="button" onClick={() => setSelectedSource(source)}>
            <FileText size={16} aria-hidden="true" /><span>{source.title || '제목을 확인할 수 없는 자료'}</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </li>)}</ul>
      </section>}
    </section>}
    {!review.isCurrent && !sources.length && review.completedAt == null && <p className="field-help">
      검토한 자료와 완료 시각을 확인할 수 없는 이전 결과입니다. 자료를 열면 현재 내용을 볼 수 있습니다.
    </p>}
    {selectedSource && <SourcePreview key={`${review.id}:${selectedSource.deliverableId}`}
      source={selectedSource} context={context} onClose={() => setSelectedSource(null)}
      onEdit={onEditSource && ((material) => {
        setSelectedSource(null);
        onEditSource(material);
      })} />}
  </>;
}

function SourcePreview({ source, context, onClose, onEdit }) {
  const { team, task, user } = context;
  const resource = useResource(
    () => findTaskDeliverable(team.id, task.id, source.deliverableId),
    [team.id, task.id, source.deliverableId],
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const material = resource.data;
  const canEdit = onEdit && material && task.completionBlockReason !== 'WORK_PERIOD_CLOSED'
    && deliverablePermissions(material, task, team, user.id).metadata;
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
  return <Modal title={source.title || '근거 자료'} onClose={onClose} wide className="ai-source-preview">
    <ResourceState resource={resource} label="근거 자료">
      {material && <div className="stack">
        <div className="ai-source-context">
          <span>수정 {formatDate(material.updatedAt)}</span>
          {canEdit && <button type="button" className="secondary-button ai-source-edit" onClick={() => onEdit(material)}>수정</button>}
        </div>
        {source.version == null ? <p className="notice">검토 당시 내용은 확인할 수 없어 현재 자료를 표시합니다.</p>
          : source.version !== material.version && <p className="notice">검토 이후 수정된 자료입니다. 현재 내용을 표시합니다.</p>}
        {material.title !== source.title && <p className="field-help">현재 제목 · {material.title}</p>}
        {material.type === 'TEXT' ? <MarkdownBody>{material.text}</MarkdownBody> : <>
          <p>{material.file?.originalFilename}</p>
          <button type="button" className="secondary-button" disabled={downloading} onClick={download}>
            <Download size={16} aria-hidden="true" />{downloading ? '다운로드 중…' : '현재 파일 다운로드'}
          </button>
          <ErrorNotice error={downloadError} />
        </>}
      </div>}
    </ResourceState>
  </Modal>;
}
