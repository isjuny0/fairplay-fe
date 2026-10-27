import { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import SectionTabs from './SectionTabs.jsx';
import RefreshButton from './RefreshButton.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { currentDateTime } from '../lib/dateTime.js';
import {
  createJoinCode,
  getJoinCode,
  revokeJoinCode,
  updateTeamBuildingPeriod,
} from '../api/spaces.js';
import useResource from '../hooks/useResource.js';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import {
  buildingLabels,
  formatDate,
  fromDateInput,
  toDateInput,
} from '../lib/domain.js';
import { ErrorNotice, Field, FormActions, ResourceState } from './ui.jsx';
import {
  collectFieldErrors,
  focusFirstFieldError,
} from '../lib/formValidation.js';

export default function SpaceSettings({ space, onChanged }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tabsId = useId();
  const activeTab = location.hash === '#join-code' ? 'join-code' : 'team-building';
  const selectTab = (tab) => navigate({ pathname: location.pathname, search: location.search, hash: tab === 'join-code' ? '#join-code' : '' }, { preventScrollReset: true });
  const codes = useResource(async () => {
    if (activeTab !== 'join-code') return null;
    try {
      return await getJoinCode(space.id);
    } catch (error) {
      if (error.code === 'JOIN_CODE_NOT_FOUND') return null;
      throw error;
    }
  }, [space.id, activeTab === 'join-code']);
  const [defaultDateTime] = useState(currentDateTime);
  const initialOpensAt =
    toDateInput(space.teamBuildingOpensAt) || defaultDateTime;
  const initialClosesAt =
    toDateInput(space.teamBuildingClosesAt) || defaultDateTime;
  const [opensAt, setOpensAt] = useState(initialOpensAt);
  const [closesAt, setClosesAt] = useState(initialClosesAt);
  const [minutes, setMinutes] = useState(1440);
  const [customDuration, setCustomDuration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [periodErrors, setPeriodErrors] = useState({});
  const [notice, setNotice] = useState('');
  const { confirm } = useInteractions();
  const periodChanged =
    opensAt !== initialOpensAt || closesAt !== initialClosesAt;
  useUnsavedChanges(periodChanged);
  const issueCode = () => createJoinCode(space.id, Number(minutes));
  useEffect(() => {
    setOpensAt(toDateInput(space.teamBuildingOpensAt) || defaultDateTime);
    setClosesAt(toDateInput(space.teamBuildingClosesAt) || defaultDateTime);
  }, [space.teamBuildingOpensAt, space.teamBuildingClosesAt]);
  useEffect(() => { setError(null); setNotice(''); }, [activeTab]);
  const run = async (action, message) => {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await action();
      setNotice(message);
      codes.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const savePeriod = (event) => {
    event.preventDefault();
    setError(null);
    const errors = collectFieldErrors(event.currentTarget, {
      ...(opensAt && closesAt && opensAt >= closesAt
        ? { closesAt: '팀 빌딩 종료 시각을 시작 시각보다 늦게 지정해 주세요.' }
        : {}),
    });
    setPeriodErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstFieldError(event.currentTarget, errors);
      return;
    }
    run(
      () =>
        updateTeamBuildingPeriod(space.id, {
          teamBuildingOpensAt: fromDateInput(opensAt),
          teamBuildingClosesAt: fromDateInput(closesAt),
          expectedVersion: space.version,
        }),
      '팀 빌딩 기간을 저장했습니다.',
    );
  };
  return (
    <section className="stack space-operation-page space-settings">
      <div className="page-heading page-heading--compact">
        <div>
          <h1>스페이스 관리</h1>
        </div>
        {activeTab === 'team-building' && <span className="status-badge">{buildingLabels[space.teamBuildingStatus]}</span>}
      </div>
      <SectionTabs id={tabsId} label="스페이스 관리 항목"
        tabs={[["team-building", "팀 빌딩 기간"], ["join-code", "참여 코드"]]}
        activeTab={activeTab} onSelect={selectTab} />
      <dl className="settings-space-overview">
        <div>
          <dt>스페이스</dt>
          <dd>{space.name}</dd>
        </div>
        <div>
          <dt>프로젝트 기간</dt>
          <dd>
            {formatDate(space.startAt)} ~ {formatDate(space.endAt)}
          </dd>
        </div>
      </dl>
      <ErrorNotice error={error} onRetry={onChanged} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="settings-tab-panel" role="tabpanel" id={`${tabsId}-team-building-panel`} aria-labelledby={`${tabsId}-team-building-tab`} hidden={activeTab !== 'team-building'}>
        <section className="panel settings-section">
          <div className="settings-section-heading">
            <h2>팀 빌딩 기간</h2>
            <p>팀 생성·가입 신청·가입 승인은 이 기간 안에서 가능합니다.</p>
          </div>
          <div className="settings-section-content">
            {space.teamBuildingOpensAt && space.teamBuildingClosesAt ? (
              <dl
                className="settings-current-period"
                aria-label="저장된 팀 빌딩 기간"
              >
                <div>
                  <dt>시작</dt>
                  <dd>{formatDate(space.teamBuildingOpensAt)}</dd>
                </div>
                <div>
                  <dt>종료</dt>
                  <dd>{formatDate(space.teamBuildingClosesAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="field-help">
                팀 빌딩 기간이 아직 설정되지 않았습니다.
              </p>
            )}
            {space.teamBuildingStatus === 'LOCKED' && (
              <p className="notice">
                평가 참여 구성이 고정되어 팀 빌딩 기간을 변경할 수 없습니다.
              </p>
            )}
            {space.teamBuildingStatus !== 'LOCKED' && (
              <form onSubmit={savePeriod} noValidate>
                <fieldset
                  className="form-fields"
                  disabled={busy || space.teamBuildingStatus === 'LOCKED'}
                >
                  <Field label="팀 빌딩 시작" error={periodErrors.opensAt}>
                    <DateTimeInput
                      name="opensAt"
                      required
                      value={opensAt}
                      onChange={(event) => {
                        setOpensAt(event.target.value);
                        setPeriodErrors({});
                      }}
                    />
                  </Field>
                  <Field label="팀 빌딩 종료" error={periodErrors.closesAt}>
                    <DateTimeInput
                      name="closesAt"
                      required
                      value={closesAt}
                      onChange={(event) => {
                        setClosesAt(event.target.value);
                        setPeriodErrors({});
                      }}
                    />
                  </Field>
                  <FormActions busy={busy} />
                </fieldset>
              </form>
            )}
            {periodChanged && opensAt && closesAt && (
              <p className="field-help" role="status">
                저장 전 입력 · {formatDate(fromDateInput(opensAt))} ~{' '}
                {formatDate(fromDateInput(closesAt))}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="settings-tab-panel" role="tabpanel" id={`${tabsId}-join-code-panel`} aria-labelledby={`${tabsId}-join-code-tab`} hidden={activeTab !== 'join-code'}>
        <section className="panel settings-section">
          <div className="settings-section-heading">
            <h2>참여 코드</h2>
            <p>
              스페이스에 참여할 사람에게 코드를 전달하세요. 팀 가입은 팀 빌딩
              기간에 별도로 진행합니다.
            </p>
            <p>코드 철회는 이미 참여한 사용자의 소속을 제거하지 않습니다.</p>
          </div>
          <div className="settings-section-content">
            <div className="section-heading">
              <h3>현재 참여 코드</h3>
              <RefreshButton
                label="코드 새로고침"
                disabled={busy || codes.loading}
                onClick={codes.reload}
              />
            </div>
            <ResourceState resource={codes}>
              {codes.data ? (
                <div className="join-code-content">
                  <strong className="join-code">{codes.data.code}</strong>
                  <dl className="settings-code-dates">
                    <div>
                      <dt>생성</dt>
                      <dd>{formatDate(codes.data.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>만료</dt>
                      <dd>{formatDate(codes.data.expiresAt)}</dd>
                    </div>
                  </dl>
                  <div className="heading-actions">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(codes.data.code);
                          setNotice('참여 코드를 복사했습니다.');
                        } catch {
                          setError(new Error('코드를 선택하여 복사해 주세요.'));
                        }
                      }}
                    >
                      코드 복사
                    </button>
                    <button
                      className="ghost-button danger"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: '참여 코드 철회',
                            message:
                              '현재 코드는 더 이상 사용할 수 없게 됩니다. 이미 참여한 사용자의 소속은 유지됩니다.',
                            label: '코드 철회',
                            danger: true,
                          })
                        )
                          run(
                            () => revokeJoinCode(space.id),
                            '참여 코드를 철회했습니다.',
                          );
                      }}
                    >
                      철회
                    </button>
                  </div>
                </div>
              ) : (
                <p>유효한 참여 코드가 없습니다.</p>
              )}
            </ResourceState>
            <form
              className="join-code-issuance"
              onSubmit={(event) => {
                event.preventDefault();
                run(issueCode, '참여 코드를 발급했습니다.');
              }}
            >
              <h3>{codes.data ? '새 코드로 교체' : '새 참여 코드 발급'}</h3>
              <Field label="코드 유효 기간">
                <select
                  value={customDuration ? 'custom' : String(minutes)}
                  onChange={(event) => {
                    setCustomDuration(event.target.value === 'custom');
                    if (event.target.value !== 'custom')
                      setMinutes(Number(event.target.value));
                  }}
                >
                  <option value="1440">1일</option>
                  <option value="4320">3일</option>
                  <option value="10080">7일</option>
                  <option value="custom">직접 입력</option>
                </select>
              </Field>
              {customDuration && (
                <Field
                  label="유효 기간 (분)"
                  help="1분부터 7일(10,080분)까지 설정할 수 있습니다."
                >
                  <input
                    type="number"
                    required
                    min={1}
                    max={10080}
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                  />
                </Field>
              )}
              <FormActions
                busy={busy || codes.loading || Boolean(codes.error)}
                label={codes.data ? '새 코드로 재발급' : '참여 코드 발급'}
              />
            </form>
            <p className="field-help">
              {codes.data
                ? '재발급하면 기존 코드는 즉시 사용할 수 없게 됩니다.'
                : '기존 만료 코드가 있으면 새 코드로 교체합니다.'}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
