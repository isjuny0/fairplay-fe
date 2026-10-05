import { useState } from 'react';
import { getSpace } from '../api/spaces.js';
import {
  createTeam,
  getTeam,
  listTeams,
  requestTeamJoin,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { buildingLabels, formatDate, isApprovedMember } from '../lib/domain.js';
import SpaceSettings from './SpaceSettings.jsx';
import TeamWorkspace from './TeamWorkspace.jsx';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function SpaceWorkspace({ spaceId, user, onBack }) {
  const resource = useResource(async () => {
    const [space, teams] = await Promise.all([
      getSpace(spaceId),
      listTeams(spaceId),
    ]);
    return {
      space,
      teams: await Promise.all(teams.map((team) => getTeam(team.id))),
    };
  }, [spaceId]);
  const [menu, setMenu] = useState('팀 목록');
  const [teamId, setTeamId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const space = resource.data?.space;
  const teams = resource.data?.teams || [];
  const isManager = space?.myRole === 'MANAGER';
  const team = teams.find((item) => item.id === teamId);
  const joinedTeam = teams.find(isApprovedMember);
  const buildingOpen =
    space?.teamBuildingStatus === 'OPEN' &&
    new Date(space.teamBuildingOpensAt) <= new Date() &&
    new Date(space.teamBuildingClosesAt) > new Date();
  const apply = async (target) => {
    setBusy(true);
    setError(null);
    try {
      await requestTeamJoin(target.id);
      resource.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createTeam(spaceId, name.trim());
      setCreating(false);
      resource.reload();
      setTeamId(created.id);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="workspace">
      <aside className="sidebar">
        <nav aria-label="스페이스 메뉴">
          <button className="nav-item" onClick={onBack}>
            ← 내 스페이스
          </button>
          <p className="nav-section">{space?.name || '스페이스'}</p>
          <button
            className={`nav-item ${menu === '팀 목록' ? 'active' : ''}`}
            onClick={() => {
              setMenu('팀 목록');
              setTeamId(null);
            }}
          >
            팀 목록
          </button>
          {isManager && (
            <button
              className={`nav-item ${menu === '스페이스 관리' ? 'active' : ''}`}
              onClick={() => {
                setMenu('스페이스 관리');
                setTeamId(null);
              }}
            >
              스페이스 관리
            </button>
          )}
          {joinedTeam && (
            <button
              className="nav-item"
              onClick={() => {
                setMenu('팀 목록');
                setTeamId(joinedTeam.id);
              }}
            >
              내 팀 · {joinedTeam.name}
            </button>
          )}
        </nav>
      </aside>
      <main className="main-content">
        <ResourceState resource={resource}>
          {space && (
            <>
              {menu === '스페이스 관리' && isManager ? (
                <SpaceSettings
                  key={space.id}
                  space={space}
                  onChanged={resource.reload}
                />
              ) : team && (isApprovedMember(team) || isManager) ? (
                <TeamWorkspace
                  key={team.id}
                  team={team}
                  user={user}
                  onChanged={resource.reload}
                  onBack={() => setTeamId(null)}
                />
              ) : (
                <section className="stack">
                  <div className="page-heading">
                    <div>
                      <span className="role-badge">
                        {isManager ? '스페이스 관리자' : '스페이스 참여자'}
                      </span>
                      <h1>{space.name}</h1>
                      <p>{space.description}</p>
                    </div>
                    <button
                      className="primary-button"
                      disabled={!buildingOpen || Boolean(joinedTeam)}
                      onClick={() => {
                        setError(null);
                        setName('');
                        setCreating(true);
                      }}
                    >
                      팀 만들기
                    </button>
                  </div>
                  <section className="panel">
                    <h2>{buildingLabels[space.teamBuildingStatus]}</h2>
                    <p>
                      프로젝트 · {formatDate(space.startAt)} ~{' '}
                      {formatDate(space.endAt)}
                    </p>
                    <p>
                      팀 빌딩 · {formatDate(space.teamBuildingOpensAt)} ~{' '}
                      {formatDate(space.teamBuildingClosesAt)}
                    </p>
                    {!buildingOpen && (
                      <p className="field-help">
                        현재 팀 생성과 가입 신청이 제한됩니다. 가입 대기는 팀
                        소속을 의미하지 않습니다.
                      </p>
                    )}
                  </section>
                  <ErrorNotice error={error} onRetry={resource.reload} />
                  {teams.length ? (
                    <ul className="team-list">
                      {teams.map((item) => (
                        <li
                          className={`team-card ${isApprovedMember(item) ? 'is-joined' : ''}`}
                          key={item.id}
                        >
                          <div className="team-card-main">
                            <h2>{item.name}</h2>
                            <p className="team-meta">
                              승인 팀원 {item.approvedMemberCount}명 ·{' '}
                              {{
                                APPROVED: '내 팀',
                                PENDING: '가입 승인 대기',
                                REJECTED: '가입 신청 반려',
                              }[item.myMembershipStatus] || '미가입'}
                            </p>
                          </div>
                          <div className="team-action">
                            {isApprovedMember(item) || isManager ? (
                              <button
                                className="secondary-button"
                                onClick={() => setTeamId(item.id)}
                              >
                                {isApprovedMember(item)
                                  ? '팀 열기'
                                  : '팀 자료 조회'}
                              </button>
                            ) : (
                              <button
                                className="primary-button"
                                disabled={
                                  busy || !buildingOpen || !item.canApply
                                }
                                onClick={() => apply(item)}
                              >
                                {item.myMembershipStatus === 'PENDING'
                                  ? '승인 대기'
                                  : item.myMembershipStatus === 'REJECTED'
                                    ? '다시 신청'
                                    : '가입 신청'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>
                      <p>아직 생성된 팀이 없습니다.</p>
                      <span>
                        {buildingOpen
                          ? '새 팀을 만들어 팀원을 모집하세요.'
                          : '팀 빌딩 기간이 열리면 팀을 만들 수 있습니다.'}
                      </span>
                    </EmptyState>
                  )}
                </section>
              )}
            </>
          )}
        </ResourceState>
        {creating && (
          <Modal
            title="팀 만들기"
            busy={busy}
            onClose={() => setCreating(false)}
          >
            <form onSubmit={submit}>
              <Field label="팀 이름">
                <input
                  required
                  maxLength={100}
                  disabled={busy}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <p className="field-help">
                생성자는 팀 리더가 됩니다. 작업은 승인된 팀원 2명 이상부터
                생성할 수 있습니다.
              </p>
              <ErrorNotice error={error} />
              <FormActions
                busy={busy}
                onCancel={() => setCreating(false)}
                label="팀 만들기"
              />
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}
