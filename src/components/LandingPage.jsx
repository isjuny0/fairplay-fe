import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  ListTodo,
  ChartNoAxesCombined,
} from 'lucide-react';
import '../landing.css';
import BrandLogo from './BrandLogo.jsx';

const examples = [
  {
    title: '작업보드',
    description: '할 일부터 완료까지, 한눈에',
    icon: ListTodo,
  },
  {
    title: '산출물',
    description: '결과물과 수행 기록을 한곳에',
    icon: FileText,
  },
  {
    title: '기여도 리포트',
    description: '함께한 과정을 근거로 확인',
    icon: ChartNoAxesCombined,
  },
];

function TaskExample() {
  const columns = [
    {
      label: '할 일',
      tone: 'todo',
      title: '사용자 인터뷰 준비',
      tag: '리서치',
      name: '박선우',
      date: '10. 21',
      progress: '인터뷰 질문 정리',
    },
    {
      label: '진행 중',
      tone: 'progress',
      title: '서비스 흐름 설계',
      tag: '기획',
      name: '김준영',
      date: '10. 22',
      progress: '사용자 여정 작성 중',
    },
    {
      label: '수정 중',
      tone: 'review',
      title: '프로토타입 검토',
      tag: '디자인',
      name: '김영진',
      date: '10. 23',
      progress: '산출물 2개 첨부',
    },
    {
      label: '완료',
      tone: 'done',
      title: '자료 조사 및 정리',
      tag: '리서치',
      name: '염승혜',
      date: '10. 20',
      progress: '작업 완료',
    },
  ];
  return (
    <div className="showcase-board">
      {columns.map((column, index) => (
        <div className={`showcase-column ${column.tone}`} key={column.label}>
          <div className="showcase-column-heading">
            <span>{column.label}</span>
            <small>1</small>
          </div>
          <div className="showcase-task">
            <span className="showcase-task-id">TASK · 0{index + 1}</span>
            <strong>{column.title}</strong>
            <span className="showcase-tag" data-category={column.tag}>
              {column.tag}
            </span>
            <p>{column.progress}</p>
            <div className="showcase-task-footer">
              <span>
                <i>{column.name.slice(0, 1)}</i>
                {column.name}
              </span>
              <span>{column.date}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeliverableExample() {
  const files = [
    ['사용자 인터뷰 결과 정리.pdf', '사용자 인터뷰', '박선우', '검토 완료'],
    ['서비스 흐름도.fig', '서비스 흐름 설계', '김준영', '검토 중'],
    ['프로토타입 테스트 기록.pdf', '프로토타입 검토', '김영진', '검토 완료'],
    ['레퍼런스 리서치.pdf', '자료 조사 및 정리', '염승혜', '검토 완료'],
  ];
  return (
    <div className="showcase-files">
      <div className="showcase-file-heading">
        <span>산출물 이름</span>
        <span>연결된 작업</span>
        <span>등록자</span>
        <span>검토 상태</span>
      </div>
      {files.map(([name, task, owner, status]) => (
        <div className="showcase-file-row" key={name}>
          <strong data-file-type={name.endsWith('.fig') ? 'design' : 'pdf'}>
            <FileText size={18} />
            {name}
          </strong>
          <span>{task}</span>
          <span>{owner}</span>
          <span
            className={`showcase-file-status ${status === '검토 중' ? 'pending' : ''}`}
          >
            {status === '검토 완료' && <Check size={12} />}
            {status}
          </span>
        </div>
      ))}
      <p className="showcase-file-note">
        <Check size={15} />
        작업에 연결된 결과물로 수행 과정을 확인하세요.
      </p>
    </div>
  );
}

function ReportExample() {
  return (
    <div className="showcase-report">
      <div className="showcase-report-summary">
        <span>팀 프로젝트 돌아보기</span>
        <h3>
          과정이 모여,
          <br />
          기여의 근거가 됩니다.
        </h3>
        <p>
          작업 수행 기록과 동료 평가를 함께 확인하고
          <br />
          팀의 협업 과정을 돌아보세요.
        </p>
        <div>
          <span>
            <Check size={14} />
            작업 수행 기록
          </span>
          <span>
            <Check size={14} />
            동료 평가
          </span>
        </div>
      </div>
      <div className="showcase-chart">
        <div>
          <strong>팀원별 최종 기여율</strong>
          <span>리포트 예시</span>
        </div>
        {[
          ['박선우', 28],
          ['김준영', 26],
          ['김영진', 24],
          ['염승혜', 22],
        ].map(([name, value]) => (
          <div className="showcase-chart-row" key={name}>
            <span>{name}</span>
            <div>
              <i style={{ width: `${value * 3}%` }} />
            </div>
            <strong>{value}%</strong>
          </div>
        ))}
        <small>화면 이해를 위한 예시 수치입니다.</small>
      </div>
    </div>
  );
}

function ProductShowcase() {
  const [active, setActive] = useState(0);
  const panels = [
    <TaskExample key="tasks" />,
    <DeliverableExample key="files" />,
    <ReportExample key="report" />,
  ];
  return (
    <section
      className="landing-showcase"
      id="features"
      aria-label="Fairplay 기능 예시"
      aria-roledescription="캐러셀"
    >
      <div className="showcase-controls">
        <div className="showcase-tabs" role="group" aria-label="예시 화면 선택">
          {examples.map(({ title, icon: Icon }, index) => (
            <button
              key={title}
              className={active === index ? 'selected' : ''}
              aria-pressed={active === index}
              onClick={() => setActive(index)}
            >
              <Icon size={17} />
              {title}
            </button>
          ))}
        </div>
      </div>
      <div className="showcase-window">
        <div className="showcase-window-bar">
          <span className="showcase-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>Fairplay · 제품 화면 예시</span>
          <span className="showcase-example-badge">예시 데이터</span>
        </div>
        <div className="showcase-workspace">
          <aside className="showcase-sidebar" aria-hidden="true">
            <div className="showcase-mini-brand">
              <BrandLogo decorative />
            </div>
            <div className="showcase-project">
              <span>TEAM PROJECT</span>
              <strong>삼위일체</strong>
            </div>
            <div className="showcase-sidebar-item">
              <LayoutDashboard size={15} />팀 홈
            </div>
            {examples.map(({ title, icon: Icon }, index) => (
              <div
                className={`showcase-sidebar-item ${active === index ? 'active' : ''}`}
                key={title}
              >
                <Icon size={15} />
                {title}
              </div>
            ))}
            <div className="showcase-sidebar-bottom">
              <i>박</i>
              <span>
                박선우<small>팀 리더</small>
              </span>
            </div>
          </aside>
          <div className="showcase-content">
            {examples.map(({ title, description }, index) => (
              <div
                key={title}
                className={`showcase-slide ${active === index ? 'is-active' : ''}`}
                aria-hidden={active !== index}
                inert={active !== index}
                role="group"
                aria-roledescription="슬라이드"
                aria-label={`${index + 1} / ${examples.length} · ${title}`}
              >
                <div className="showcase-page-heading">
                  <div>
                    <span>
                      삼위일체 <ChevronRight size={12} /> {title}
                    </span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                  <span className="showcase-team-avatars" aria-hidden="true">
                    <i>박</i>
                    <i>김</i>
                    <i>염</i>
                  </span>
                </div>
                {panels[index]}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="showcase-caption">
        <span>실제 기능을 소개하는 예시 화면입니다.</span>
        <span>
          {String(active + 1).padStart(2, '0')} <i>/ 03</i>
        </span>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">
        본문으로 이동
      </a>
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Fairplay 홈">
          <BrandLogo decorative />
        </Link>
        <nav aria-label="소개 메뉴">
          <a href="#features">기능 살펴보기</a>
          <Link to="/login">로그인</Link>
          <Link className="landing-button compact" to="/login">
            시작하기 <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <p className="landing-eyebrow">
            <span />
            함께한 과정까지, Fairplay
          </p>
          <h1>
            함께 만드는 프로젝트,
            <br />
            <em>모두의 노력이 빛날 수 있도록.</em>
          </h1>
          <p className="landing-hero-description">
            할 일을 나누고, 결과를 쌓고, 함께한 기여를 확인하세요.
            <br />
            팀의 시작부터 마지막 회고까지 하나의 흐름으로.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-button" to="/login">
              Fairplay 시작하기 <ArrowRight size={17} />
            </Link>
            <a className="landing-text-link" href="#features">
              화면 먼저 살펴보기 <ChevronRight size={16} />
            </a>
          </div>
        </section>
        <ProductShowcase />
        <section className="landing-workflow" aria-labelledby="workflow-title">
          <div className="landing-section-heading">
            <span>LESS FRICTION, MORE TEAMWORK</span>
            <h2 id="workflow-title">흩어진 팀워크를, 하나의 흐름으로.</h2>
            <p>누가 무엇을 했는지, 어떤 결과를 만들었는지 놓치지 마세요.</p>
          </div>
          <div className="landing-workflow-grid">
            {examples.map(({ title, icon: Icon }, index) => (
              <article key={title}>
                <span className="landing-feature-icon">
                  <Icon size={21} />
                </span>
                <small>0{index + 1}</small>
                <h3>
                  {
                    [
                      '명확하게 나누는 작업',
                      '차곡차곡 쌓이는 결과',
                      '근거로 돌아보는 기여',
                    ][index]
                  }
                </h3>
                <p>
                  {
                    [
                      '담당자와 작업 상태를 한눈에 확인하고, 팀의 다음 할 일을 정하세요.',
                      '작업에 산출물과 수행 설명을 남기고 직접 완료하세요.',
                      '수행 기록과 동료 평가를 바탕으로, 함께한 과정을 확인하세요.',
                    ][index]
                  }
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-bottom-cta">
          <div>
            <p>더 선명한 협업의 시작</p>
            <h2>우리 팀의 다음 프로젝트는 Fairplay에서.</h2>
          </div>
          <Link className="landing-button" to="/login">
            지금 시작하기 <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <BrandLogo />
        <p>팀의 과정에 기록을, 기여에 근거를.</p>
        <span>© {new Date().getFullYear()} Fairplay</span>
      </footer>
    </div>
  );
}
