import { useId, useRef, useState } from 'react';
import { guideScenarios } from '../mock/guide.js';

const audiences = [
  { id: 'member', label: '팀원 가이드' },
  { id: 'manager', label: '관리자 가이드' },
];

export default function PreviewGuideLauncher({ onStart, onFreeExplore, initialAudience = 'member', busy = false }) {
  const [audience, setAudience] = useState(initialAudience);
  const id = useId();
  const tabButtons = useRef({});
  const navigateTabs = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') nextIndex = 1 - index;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = audiences.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const next = audiences[nextIndex].id;
    setAudience(next);
    tabButtons.current[next]?.focus();
  };
  return <>
    <p className="preview-guide-launcher-intro">사용해 볼 흐름을 선택하세요. 예시 데이터로 진행하며 실제 서버에 저장하거나 AI를 호출하지 않습니다.</p>
    <div className="preview-guide-audience-tabs" role="tablist" aria-label="사용자 가이드 구분">
      {audiences.map((group, index) => <button
        key={group.id}
        ref={(button) => { tabButtons.current[group.id] = button; }}
        type="button"
        role="tab"
        id={`${id}-${group.id}-tab`}
        aria-controls={`${id}-${group.id}-panel`}
        aria-selected={audience === group.id}
        tabIndex={audience === group.id ? 0 : -1}
        onClick={() => setAudience(group.id)}
        onKeyDown={(event) => navigateTabs(event, index)}
      >{group.label}</button>)}
    </div>
    {audiences.map((group) => <section
      key={group.id}
      role="tabpanel"
      id={`${id}-${group.id}-panel`}
      aria-labelledby={`${id}-${group.id}-tab`}
      hidden={audience !== group.id}
      tabIndex={0}
    >
      <ul className="preview-guide-scenario-list" aria-label={`${group.label} 목록`}>
        {guideScenarios.filter((scenario) => scenario.audience === group.id)
          .sort((first, second) => Number(second.available) - Number(first.available))
          .map((scenario) => <li className={`preview-guide-scenario${scenario.available ? '' : ' is-unavailable'}`} key={scenario.id}>
          <div className="preview-guide-scenario-copy">
            <div className="preview-guide-scenario-heading">
              <h3>{scenario.title}</h3>
              {(scenario.id === 'task-completion' || !scenario.available) && <span className={`preview-guide-scenario-badge${scenario.available ? ' is-recommended' : ''}`}>{scenario.available ? '처음이라면 추천' : '준비 중'}</span>}
            </div>
            <p>{scenario.purpose}</p>
          </div>
          <span className="preview-guide-scenario-count">{scenario.available ? `${scenario.stepCount}단계` : `${scenario.stepCount}단계 예정`}</span>
          <button
            type="button"
            className={scenario.id === 'task-completion' ? 'primary-button' : 'secondary-button'}
            disabled={busy || !scenario.available}
            aria-label={`${scenario.title} 시작${scenario.available ? '' : ' (준비 중)'}`}
            onClick={() => onStart(scenario.id)}
          >시작</button>
        </li>)}
      </ul>
    </section>)}
    <p className="preview-guide-launcher-note">시작할 때마다 예시 데이터를 초기화하고 첫 단계부터 진행합니다.</p>
    <div className="preview-guide-free-explore">
      <div><strong>자유롭게 둘러보기</strong><p>역할과 상황을 바꾸며 원하는 화면을 살펴보세요.</p></div>
      <button type="button" className="ghost-button" disabled={busy} onClick={onFreeExplore}>자유 탐색 시작</button>
    </div>
  </>;
}
