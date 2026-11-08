import { Link } from 'react-router';
import { ArrowRight, Check, ChevronRight, FolderOpen, GraduationCap, Layers, LayoutDashboard, Trophy, Users } from 'lucide-react';
import '../landing.css';
import BrandLogo from './BrandLogo.jsx';
import LandingShowcase, { showcaseExamples as examples } from './LandingShowcase.jsx';
import { landingScreenUrl } from '../lib/landingScreens.js';

const useCases = [
  { title: '수업과 캡스톤디자인', icon: GraduationCap, description: '여러 팀의 프로젝트를 운영하고\n팀별 진행 상황과 결과물을 확인하세요.\n수행 기록과 동료 평가로 각자의 기여도\n함께 살펴볼 수 있습니다.' },
  { title: '동아리와 학회', icon: Users, description: '운영진은 공지와 팀별 활동을 관리하고\n구성원은 소속 팀에서 협업하세요.\n동시에 진행되는 여러 활동을\n하나의 공간에 모을 수 있습니다.' },
  { title: '스터디와 프로젝트 모임', icon: Trophy, description: '스터디부터 공모전까지\n공동의 목표에 맞춰 역할과 일정을 나누세요.\n함께한 과정과 결과물을\n다음 협업을 위한 기록으로 남깁니다.' },
];
const teamFeatures = [
  { title: '무엇을 맡고 어디까지 했는지 명확하게.', description: '작업별 담당자와 일정,\n예상 작업량과 담당 비율을 정하세요.\n팀 리더는 업무 배분과 진행 흐름을 살펴보고\n팀원은 자신이 맡은 작업에 집중할 수 있습니다.' },
  { title: '결과물과 그 과정을 함께 남기세요.', description: '문서와 파일을 관련 작업에 연결하고\n수행 설명을 남기세요.\n회의록과 팀 자료 검색으로 필요한 내용을 다시 찾고\nAI 피드백으로 결과물의 개선 방향도\n살펴볼 수 있습니다.' },
  { title: '함께한 노력을 기억이 아닌 기록으로.', description: '완료 작업과 담당 비율, 동료 평가를 바탕으로\n기여도와 그 근거를 확인하세요.\n숫자 하나로 단정하는 대신\n서로의 노력을 이해하고\n다음 협업을 개선하는 자료로 활용합니다.' },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">본문으로 이동</a>
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Fairplay 홈"><BrandLogo decorative /></Link>
        <nav aria-label="소개 메뉴">
          <a href="#use-cases">이런 곳에 함께해요</a>
          <a href="#features">기능 살펴보기</a>
          <Link to="/login">로그인</Link>
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span />여러 팀의 운영과 협업을 연결하는 Fairplay</p>
              <h1>여러 팀의 활동을 한 공간에서<br /><em>함께한 기여까지 선명하게.</em></h1>
              <p className="landing-hero-description">
                수업·동아리·프로젝트 프로그램의 운영부터<br />
                팀별 협업과 개인의 기여도 확인까지 연결합니다.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-button" to="/login">Fairplay 시작하기 <ArrowRight size={17} /></Link>
                <a className="landing-text-link" href="#features">서비스 살펴보기 <ChevronRight size={16} /></a>
              </div>
            </div>
            <div className="landing-hero-visual" aria-hidden="true">
              <div className="hero-visual-backdrop">
                <div className="hero-visual-board"><img src={landingScreenUrl('manager')} alt="" width="2880" height="1620" decoding="async" /></div>
              </div>
              <div className="hero-visual-report"><img src={landingScreenUrl('report', 'mobile')} alt="" width="780" height="1560" decoding="async" /></div>
            </div>
          </div>
        </section>

        <section className="landing-use-cases landing-content-section" id="use-cases" aria-labelledby="use-cases-title">
          <div className="landing-section-heading">
            <span>함께 활동하는 모두를 위해</span>
            <h2 id="use-cases-title">수업부터 동아리까지<br />함께 활동하는 곳 어디서나.</h2>
            <p>{'하나의 팀을 넘어\n여러 팀이 함께하는 활동에 맞춰 사용하세요.'}</p>
          </div>
          <div className="landing-use-case-grid">
            {useCases.map(({ title, icon: Icon, description }) => (
              <article key={title}>
                <span className="landing-use-case-icon"><Icon size={25} aria-hidden="true" /></span>
                <h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-space-section" aria-labelledby="space-structure-title">
          <div className="landing-space-inner">
            <div className="landing-space-copy">
              <p className="landing-eyebrow"><Layers size={16} aria-hidden="true" />스페이스로 연결되는 활동</p>
              <h2 id="space-structure-title">하나의 스페이스 안에서<br />팀마다 이어지는 협업.</h2>
              <p>{'수업이나 동아리를 하나의 ‘스페이스’로 구성하고\n그 안에서 여러 팀이 각자의 프로젝트를 진행합니다.'}</p>
              <dl className="landing-role-list">
                <div><dt>관리자</dt><dd>{'전체 공지와 참여자,\n여러 팀의 활동을 한눈에 관리합니다.'}</dd></div>
                <div><dt>팀 리더·팀원</dt><dd>{'소속 팀에서 역할을 나누고\n작업과 자료를 함께 관리합니다.'}</dd></div>
              </dl>
            </div>
            <figure className="landing-space-diagram" aria-label="하나의 스페이스 안에 여러 팀이 있는 구조 예시">
              <figcaption>스페이스 구조 예시</figcaption>
              <div className="landing-space-node"><Layers size={24} aria-hidden="true" /><strong>스페이스</strong><span>수업 · 동아리 · 프로젝트 프로그램</span></div>
              <div className="landing-space-branches">
                {['A팀', 'B팀', 'C팀'].map((team) => (
                  <div className="landing-team-node" key={team}><Users size={22} aria-hidden="true" /><strong>{team}</strong><span>작업 · 자료 · 팀원</span></div>
                ))}
              </div>
              <p className="landing-space-shared"><FolderOpen size={16} aria-hidden="true" />전체 공지와 운영은 함께, 협업은 팀별로.</p>
            </figure>
          </div>
        </section>

        <section className="landing-manager landing-content-section" aria-labelledby="manager-title">
          <div className="landing-manager-copy">
            <p className="landing-eyebrow"><LayoutDashboard size={16} aria-hidden="true" />관리자를 위한 운영 공간</p>
            <h2 id="manager-title">팀이 많아져도<br />진행 상황을 놓치지 않도록.</h2>
            <p>{'여러 팀의 정보를 각각 찾아다니지 않아도 됩니다.\n전체 현황을 살펴보고\n필요한 팀의 세부 내용으로 이동하세요.'}</p>
            <ul>
              {['전체 공지사항과 참여자·팀 구성 관리', '팀별 작업 진행 상황과 등록 자료 확인', '동료 평가 일정과 팀별 제출 현황 관리'].map((item) => (
                <li key={item}><Check size={17} aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>
          <figure className="landing-manager-screen">
            <picture>
              <source media="(max-width: 600px)" srcSet={landingScreenUrl('manager', 'mobile')} width="780" height="1560" />
              <img src={landingScreenUrl('manager')} alt="여러 팀의 작업 진행률과 현황을 함께 확인하는 실제 관리자 팀 관리 화면" width="2880" height="1620" loading="lazy" decoding="async" />
            </picture>
            <figcaption>실제 관리자 화면 · 예시 데이터</figcaption>
          </figure>
        </section>

        <div className="landing-collaboration-intro landing-content-section">
          <p className="landing-eyebrow">팀 리더와 팀원을 위한 협업 공간</p>
          <h2>역할을 나누는 순간부터<br />함께한 과정을 돌아볼 때까지.</h2>
          <p>작업·자료·평가를 연결해 팀의 협업 흐름을 이어갑니다.</p>
        </div>
        <LandingShowcase />
        <section className="landing-workflow" aria-labelledby="workflow-title">
          <div className="landing-section-heading">
            <span>협업의 과정이 기여의 근거로</span>
            <h2 id="workflow-title">역할부터 결과물,<br />기여도까지 하나의 흐름으로.</h2>
            <p>{'누가 무엇을 맡았고 어떤 결과를 남겼는지\n기록을 바탕으로 함께 확인하세요.'}</p>
          </div>
          <div className="landing-workflow-grid">
            {examples.map(({ id, title, icon: Icon }, index) => (
              <article key={title}>
                <div className="landing-feature-copy">
                  <div className="landing-feature-meta"><small>0{index + 1}</small><span className="landing-feature-icon"><Icon size={22} aria-hidden="true" /></span></div>
                  <h3>{teamFeatures[index].title}</h3>
                  <p>{teamFeatures[index].description}</p>
                </div>
                <div className="landing-feature-visual" aria-hidden="true"><img src={landingScreenUrl(id)} alt="" width="2880" height="1620" loading="lazy" decoding="async" /></div>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-bottom-cta">
          <div>
            <h2>여러 팀의 시작부터<br />함께한 과정의 마무리까지.</h2>
            <p className="landing-cta-description">수업과 동아리, 다음 프로젝트를 Fairplay에서 시작하세요.</p>
          </div>
          <Link className="landing-button" to="/login">지금 시작하기 <ArrowRight size={17} /></Link>
        </section>
      </main>
      <footer className="landing-footer">
        <BrandLogo /><span>© {new Date().getFullYear()} Fairplay</span>
      </footer>
    </div>
  );
}
