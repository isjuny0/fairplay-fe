import { useEffect, useState } from 'react';
import { ChartNoAxesCombined, ChevronLeft, ChevronRight, FileText, ListTodo, Pause, Play } from 'lucide-react';
import { landingScreenUrl } from '../lib/landingScreens.js';

export const showcaseExamples = [
  { id: 'tasks', title: '작업보드',
    description: '담당자와 진행 상태를 한눈에 확인하는 실제 작업보드', icon: ListTodo },
  { id: 'materials', title: '팀 자료',
    description: '작업에 연결된 문서와 파일을 모아 보는 실제 팀 자료 화면', icon: FileText },
  { id: 'report', title: '기여도 리포트',
    description: '완료 작업과 동료 평가를 함께 확인하는 실제 기여도 리포트', icon: ChartNoAxesCombined },
];

const INTERVAL_MS = 3000;

export default function LandingShowcase() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const rotating = playing && !hovered && !focused && !hidden;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = (event) => { if (event.matches) setPlaying(false); };
    const onVisibility = () => setHidden(document.hidden);
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!rotating) return undefined;
    const timeout = window.setTimeout(() => setActive((current) => (current + 1) % showcaseExamples.length), INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [active, rotating]);

  const move = (direction) => setActive((current) => (current + direction + showcaseExamples.length) % showcaseExamples.length);

  return (
    <section className="landing-showcase" id="features" aria-label="Fairplay 기능 예시" aria-roledescription="캐러셀"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="showcase-controls">
        <div className="showcase-tabs" role="group" aria-label="예시 화면 선택">
          {showcaseExamples.map(({ id, title, icon: Icon }, index) => (
            <button type="button" key={id} className={active === index ? 'selected' : ''}
              aria-pressed={active === index} aria-controls={`showcase-${id}`} onClick={() => setActive(index)}>
              <Icon size={17} aria-hidden="true" />{title}
            </button>
          ))}
        </div>
      </div>
      <div className="showcase-window">
        <div className="showcase-window-bar">
          <span className="showcase-window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>Fairplay · {showcaseExamples[active].title}</span>
          <span className="showcase-example-badge">실제 서비스 화면</span>
        </div>
        <div className="showcase-screen" aria-live={rotating ? 'off' : 'polite'}>
          {showcaseExamples.map(({ id, title, description }, index) => (
            <div id={`showcase-${id}`} key={id} className={`showcase-slide ${active === index ? 'is-active' : ''}`}
              aria-hidden={active !== index} inert={active !== index} role="group" aria-roledescription="슬라이드"
              aria-label={`${index + 1} / ${showcaseExamples.length} · ${title}`}>
              <picture>
                <source media="(max-width: 600px)" srcSet={landingScreenUrl(id, 'mobile')} width="780" height="1560" />
                <img src={landingScreenUrl(id)} alt={description} width="2880" height="1620" decoding="async" draggable="false" />
              </picture>
            </div>
          ))}
        </div>
      </div>
      <div className="showcase-caption">
        <span>실제 서비스 화면 · 예시 데이터</span>
        <div className="showcase-navigation" role="group" aria-label="기능 화면 전환">
          <button type="button" onClick={() => move(-1)} aria-label="이전 기능 화면"><ChevronLeft size={16} aria-hidden="true" /></button>
          <span className="showcase-count" aria-label={`${active + 1} / ${showcaseExamples.length}`}>
            {String(active + 1).padStart(2, '0')}<i>/ 03</i>
          </span>
          <button type="button" onClick={() => move(1)} aria-label="다음 기능 화면"><ChevronRight size={16} aria-hidden="true" /></button>
          <button type="button" className="showcase-playback" aria-label={playing ? '화면 자동 전환 일시정지' : '화면 자동 전환 재생'}
            title={playing ? '3초마다 자동 전환 · 일시정지' : '3초마다 자동 전환 재생'}
            onClick={() => { setPlaying((current) => !current); setFocused(false); }}>
            {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  );
}
