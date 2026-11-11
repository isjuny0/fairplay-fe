import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, FileText, MessageSquare, Plus, Sparkles,
} from 'lucide-react';
import { acknowledgeTeamBriefing, getTeamBriefing } from '../../api/teamBriefing.js';
import useResource from '../../hooks/useResource.js';
import { apiTimeToEpoch } from '../../lib/koreanTime.js';
import { isPreviewPath } from '../../lib/previewPath.js';
import { teamMenuPath } from '../../lib/routes.js';
import { statusLabels } from '../../lib/domain.js';
import '../../team-briefing.css';

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function BriefingItem({ item, spaceId, teamId, prominent = false }) {
  const { pathname } = useLocation();
  const menu = item.targetType === 'TASK' ? '작업' : '팀 자료';
  const destination = teamMenuPath(spaceId, teamId, menu);
  const target = item.targetType === 'TASK'
    ? `${destination}/${item.targetId}`
    : `${destination}?deliverableId=${item.targetId}`;
  const href = isPreviewPath(pathname) ? `/preview${target}` : target;
  const completed = item.type === 'TASK_COMPLETED';
  const attention = item.priority === 'ATTENTION';
  let ItemIcon = Clock3;
  if (completed) ItemIcon = CheckCircle2;
  else if (item.targetType === 'DELIVERABLE') ItemIcon = FileText;
  else if (item.type === 'TASK_COMMENT_CREATED') ItemIcon = MessageSquare;
  else if (item.type === 'TASK_CREATED') ItemIcon = Plus;
  const occurredAt = apiTimeToEpoch(item.occurredAt);

  return (
    <li className={`team-briefing-item${prominent ? ' is-highlight' : ''}${attention ? ' needs-attention' : ''}${completed ? ' is-completed' : ''}`}>
      <span className="team-briefing-item-icon" aria-hidden="true"><ItemIcon size={prominent ? 21 : 18} /></span>
      <div className="team-briefing-item-copy">
        <Link to={href} className="team-briefing-item-link">
          {item.title}<ArrowUpRight size={13} aria-hidden="true" />
        </Link>
        {prominent && <p>{item.description}</p>}
      </div>
      <div className="team-briefing-item-meta">
        {prominent && item.status && (
          <span className={`team-briefing-status status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
        )}
        {Number.isFinite(occurredAt) && <time dateTime={`${item.occurredAt}+09:00`}>{timeFormatter.format(occurredAt)}</time>}
      </div>
    </li>
  );
}

export default function TeamBriefingCard(props) {
  return <BriefingCard key={`${props.userId}:${props.teamId}`} {...props} />;
}

function BriefingCard({ spaceId, teamId, userId }) {
  const resource = useResource(() => getTeamBriefing(teamId), [teamId, userId]);
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState(null);
  const savingRef = useRef(false);
  const detailsId = useId();

  const acknowledge = async () => {
    if (savingRef.current || resource.loading || !resource.data?.ackToken) return;
    savingRef.current = true;
    setSaving(true);
    setAcknowledgeError(null);
    try {
      await acknowledgeTeamBriefing(teamId, resource.data.ackToken);
      setAcknowledged(true);
    } catch (error) {
      setAcknowledgeError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (acknowledged) {
    return <p className="team-briefing-confirmed" role="status"><CheckCircle2 size={20} />새로운 변경 사항을 모두 확인했어요.</p>;
  }
  if (resource.loading && !resource.data) {
    return <div className="team-briefing-skeleton" role="status" aria-label="팀 브리핑 불러오는 중"><span /><span /></div>;
  }
  if (resource.error || !resource.data?.hasUpdates) return null;

  const briefing = resource.data;
  const highlightIds = new Set(briefing.highlights.map((item) => item.id));
  const additionalItems = briefing.items.filter((item) => !highlightIds.has(item.id));
  const expired = acknowledgeError?.code === 'TEAM_BRIEFING_EXPIRED';

  return (
    <section className="team-briefing-card" aria-label="지난 방문 이후">
      <h2 className="team-briefing-heading">
        <button type="button" onClick={() => setExpanded(!expanded)} aria-label={`지난 방문 이후 브리핑 ${expanded ? '접기' : '펼치기'}`} aria-expanded={expanded} aria-controls={detailsId}>
          <span className="team-briefing-heading-copy">
            <span className="team-briefing-eyebrow"><Sparkles size={18} aria-hidden="true" />지난 방문 이후</span>
            <strong>{briefing.headline}</strong>
            {!expanded && <span className="team-briefing-summary">{briefing.highlights.map((item) => item.title).join(' ')}</span>}
          </span>
          <ChevronDown className={expanded ? 'is-open' : ''} size={20} aria-hidden="true" />
        </button>
      </h2>
      <div id={detailsId} hidden={!expanded} className="team-briefing-details">
        <ul className="team-briefing-highlights" aria-label="주요 변경">
          {briefing.highlights.map((item) => <BriefingItem key={item.id} item={item} spaceId={spaceId} teamId={teamId} prominent />)}
        </ul>
        {additionalItems.length > 0 && (
          <div className="team-briefing-additional">
            <h3>그 밖의 변경 <span>({additionalItems.length}건)</span></h3>
            <ul aria-label="추가 변경">
              {additionalItems.map((item) => <BriefingItem key={item.id} item={item} spaceId={spaceId} teamId={teamId} />)}
            </ul>
          </div>
        )}
      </div>
      <footer className="team-briefing-actions">
        <button type="button" className="team-briefing-toggle" onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded} aria-controls={detailsId}>
          {expanded ? '간략히 보기' : '모든 변경 보기'}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button type="button" className="team-briefing-acknowledge" disabled={saving || resource.loading}
          onClick={acknowledge} aria-label={`변경 ${briefing.totalEventCount}개 모두 확인`}>
          <Check size={16} aria-hidden="true" />{saving ? '확인 중…' : '확인했어요'}
        </button>
      </footer>
      {acknowledgeError && (
        <div className="team-briefing-error" role="alert">
          <p>{expired ? '브리핑 유효 시간이 지났어요. 다시 불러온 뒤 확인해주세요.' : '확인 상태를 저장하지 못했어요. 다시 시도해주세요.'}</p>
          {expired && <button type="button" onClick={() => { setAcknowledgeError(null); resource.reload(); }}>브리핑 다시 불러오기</button>}
        </div>
      )}
    </section>
  );
}
