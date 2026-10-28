import { useId, useState } from 'react';
import { ChevronDown, CircleHelp, Download, FileText } from 'lucide-react';
import { ApiError } from '../api/client.js';
import { downloadDeliverable, listDeliverables } from '../api/deliverables.js';
import useResource from '../hooks/useResource.js';
import { ErrorNotice, ResourceState } from './ui.jsx';
import MarkdownBody from './MarkdownBody.jsx';
import { formatDate, formatExpectedWorkload } from '../lib/domain.js';
import { formatReportNumber } from './ReportScore.jsx';

const formatWorkUnits = (value) => value == null ? '—' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function ContributionEvidenceList({ evidence, showCalculation = true, compact = false }) {
  const [taskId, setTaskId] = useState(null);
  return <div className="contribution-evidence-list">
    {!compact && <p className="evidence-list-caption">{evidence.tasks.length}건 <span>리포트에 반영된 작업 기준</span></p>}
    {evidence.tasks.length === 0 && <div className="empty-state"><h3>반영된 완료 작업이 없습니다.</h3>
      {showCalculation && <p>동료 평가를 통한 반영분은 기여율 구성에서 확인할 수 있습니다.</p>}</div>}
    {evidence.tasks.map((task) => <article key={task.taskId} className={`evidence-task${taskId === task.taskId ? ' is-open' : ''}`}>
      <button type="button" className="evidence-task-toggle" aria-expanded={taskId === task.taskId}
        aria-controls={`report-${evidence.reportId}-evidence-${task.taskId}`}
        onClick={() => setTaskId(taskId === task.taskId ? null : task.taskId)}>
        <span className="evidence-task-name"><span>#{task.taskId}</span><strong>{task.current.title || `작업 #${task.taskId}`}</strong></span>
        <span className="evidence-task-allocation">담당 {task.allocationAtCutoff}%</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      <div className="evidence-task-summary"><span>작업량 · {formatExpectedWorkload(task.weightAtCutoff)} <TaskAllocationHelp task={task} /></span>
        <span>완료 {formatDate(task.completedAt)}</span></div>
      {taskId === task.taskId && <div className="evidence-task-body" id={`report-${evidence.reportId}-evidence-${task.taskId}`}>
        {task.current.availability === 'MISSING' ? <p className="notice">현재 작업을 조회할 수 없습니다. 리포트에 저장된 완료일·작업량·담당 비율은 유지됩니다.</p>
          : <CurrentEvidence key={`${task.taskId}:${task.current.version}`} task={task} evidence={evidence} />}
      </div>}
    </article>)}
    {showCalculation && evidence.tasks.length > 0 && <div className="evidence-work-formula">
      <h3>완료 작업은 어떻게 반영됐나요?</h3>
      <p>본인 반영 작업량 <strong>{formatWorkUnits(evidence.workSummary.memberUnits)}</strong> / 팀 전체 <strong>{formatWorkUnits(evidence.workSummary.teamUnits)}</strong></p>
      <p>팀 내 비율 {formatReportNumber(evidence.workSummary.taskRatioPercent)}% × 반영 비중 {evidence.workSummary.taskWeightPercent}% = <strong>{formatReportNumber(evidence.workSummary.taskContributionPercent)}%p</strong></p>
    </div>}
    <p className="evidence-time-note">완료일·작업량·담당 비율은 확정된 계산값입니다. 작업명·수행 설명·연결 자료는 현재 조회한 내용입니다.</p>
  </div>;
}

function TaskAllocationHelp({ task }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return <span className="report-component-help evidence-allocation-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <button type="button" aria-label="담당 비율의 기여도 반영 방식" aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open && <span className="report-component-tooltip" id={tooltipId} role="tooltip">
        작업 규모에 부여한 점수에 리포트 집계 당시의 담당 비율을 곱합니다.
        <span>{formatWorkUnits(task.weightAtCutoff)}점 × {task.allocationAtCutoff}% = {formatWorkUnits(task.assignedUnits)}점 반영</span>
        <span>완료 작업에서 반영된 본인 점수를 합산해 팀 전체 점수와 비교합니다. 점수는 실제 소요 시간을 의미하지 않습니다.</span>
      </span>}
    </span>;
}

function CurrentEvidence({ task, evidence }) {
  const [materialId, setMaterialId] = useState(null);
  const material = task.current.materials.find((item) => item.id === materialId);
  return <>
    <div className="evidence-current-label">현재 작업 정보 <span>수정 {formatDate(task.current.updatedAt)}</span></div>
    <section className="evidence-contribution"><h4>본인 수행 설명</h4>
      <p className="preserve-lines">{task.current.contributionDescription || '현재 조회할 수 있는 수행 설명이 없습니다.'}</p></section>
    <section className="evidence-materials"><div className="section-heading"><h4>현재 연결 자료</h4><span>{task.current.materials.length}개</span></div>
      {task.current.materials.length === 0 ? <p className="field-help">현재 연결된 자료가 없습니다.</p> : <ul>
        {task.current.materials.map((item) => <li key={item.id}><button type="button" aria-expanded={materialId === item.id}
          onClick={() => setMaterialId(materialId === item.id ? null : item.id)}>
          <FileText size={16} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.type === 'FILE' ? '파일' : '문서'} · 버전 {item.version} · {formatDate(item.updatedAt)}</small></span>
          <ChevronDown size={15} aria-hidden="true" />
        </button></li>)}
      </ul>}
      {material && <MaterialPreview key={`${material.id}:${material.version}`} material={material} taskId={task.taskId}
        evidence={evidence} />}
    </section>
  </>;
}

function MaterialPreview({ material, taskId, evidence }) {
  const resource = useResource(async () => {
    for (let page = 0; ; page++) {
      const items = await listDeliverables(evidence.teamId, { taskId, page, size: 100 });
      const found = items.find((item) => item.id === material.id);
      if (found) {
        if (found.teamId !== evidence.teamId || found.taskId !== taskId) throw new ApiError(502, { message: '선택한 작업에 연결된 자료를 확인하지 못했습니다.' });
        return found;
      }
      if (items.length < 100) throw new ApiError(404, { code: 'DELIVERABLE_NOT_FOUND', message: '자료가 삭제되었거나 연결이 변경되었습니다. 작업 근거를 새로고침해 주세요.' });
    }
  }, [evidence.teamId, taskId, material.id, material.version]);
  const [downloadError, setDownloadError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const item = resource.data;
  const download = async () => {
    setDownloading(true); setDownloadError(null);
    try {
      const blob = await downloadDeliverable(material.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = item.file.originalFilename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error); }
    finally { setDownloading(false); }
  };
  return <div className="evidence-material-preview">
    <ResourceState resource={resource} label="연결 자료">
      {item && <>
        <div className="evidence-current-label">현재 자료 · 버전 {item.version}</div>
        {item.version !== material.version && <p className="notice">목록 조회 후 변경된 최신 자료입니다. 작업 근거를 새로고침해 주세요.</p>}
        {item.type === 'TEXT' ? <MarkdownBody>{item.text}</MarkdownBody> : <>
          <p>{item.file?.originalFilename}</p><button type="button" className="secondary-button" disabled={downloading} onClick={download}>
            <Download size={15} aria-hidden="true" />{downloading ? '다운로드 중…' : '파일 다운로드'}</button><ErrorNotice error={downloadError} />
        </>}

      </>}
    </ResourceState>
  </div>;
}
