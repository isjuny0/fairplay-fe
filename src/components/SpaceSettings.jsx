import { useEffect, useState } from 'react';
import {
  createJoinCode,
  getJoinCode,
  revokeJoinCode,
  rotateJoinCode,
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
  const codes = useResource(async () => {
    try {
      return await getJoinCode(space.id);
    } catch (error) {
      if (error.code === 'JOIN_CODE_NOT_FOUND') return null;
      throw error;
    }
  }, [space.id]);
  const [opensAt, setOpensAt] = useState(
    toDateInput(space.teamBuildingOpensAt),
  );
  const [closesAt, setClosesAt] = useState(
    toDateInput(space.teamBuildingClosesAt),
  );
  const [minutes, setMinutes] = useState(1440);
  const [customDuration, setCustomDuration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [periodErrors, setPeriodErrors] = useState({});
  const [notice, setNotice] = useState('');
  const { confirm } = useInteractions();
  useUnsavedChanges(
    opensAt !== toDateInput(space.teamBuildingOpensAt) ||
      closesAt !== toDateInput(space.teamBuildingClosesAt),
  );
  const issueCode = async () => {
    if (codes.data) return rotateJoinCode(space.id, Number(minutes));
    try {
      return await createJoinCode(space.id, Number(minutes));
    } catch (error) {
      // 조회에서 숨겨진 만료 코드가 남아 있으면 같은 발급 요청으로 교체한다.
      if (error.code !== 'JOIN_CODE_ALREADY_EXISTS') throw error;
      return rotateJoinCode(space.id, Number(minutes));
    }
  };
  useEffect(() => {
    setOpensAt(toDateInput(space.teamBuildingOpensAt));
    setClosesAt(toDateInput(space.teamBuildingClosesAt));
  }, [space.version, space.teamBuildingOpensAt, space.teamBuildingClosesAt]);
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
    <section className="stack">
      <div>
        <h1>스페이스 관리</h1>
        <p>
          {space.name} · {buildingLabels[space.teamBuildingStatus]}
        </p>
      </div>
      <ErrorNotice error={error} onRetry={onChanged} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="settings-grid">
        <section className="panel">
          <h2>팀 빌딩 기간</h2>
          <p className="field-help">
            팀 생성·가입 신청·가입 승인은 이 기간 안에서 가능합니다. 모든 시각은
            한국 시간입니다.
          </p>
          <form onSubmit={savePeriod} noValidate>
            <fieldset
              className="form-fields"
              disabled={busy || space.teamBuildingStatus === 'LOCKED'}
            >
              <Field label="팀 빌딩 시작" error={periodErrors.opensAt}>
                <input
                  name="opensAt"
                  required
                  type="datetime-local"
                  value={opensAt}
                  onChange={(event) => {
                    setOpensAt(event.target.value);
                    setPeriodErrors({});
                  }}
                />
              </Field>
              <Field label="팀 빌딩 종료" error={periodErrors.closesAt}>
                <input
                  name="closesAt"
                  required
                  type="datetime-local"
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
          {opensAt && closesAt && (
            <p className="field-help">
              설정 기간 · {formatDate(fromDateInput(opensAt))} ~{' '}
              {formatDate(fromDateInput(closesAt))}
            </p>
          )}
          {space.teamBuildingStatus === 'LOCKED' && (
            <p className="notice">
              평가 참여 구성이 고정되어 팀 빌딩 기간을 변경할 수 없습니다.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>참여 코드</h2>
          <p className="field-help">
            코드 철회는 이미 참여한 사용자의 소속을 제거하지 않습니다.
          </p>
          <ResourceState resource={codes}>
            {codes.data ? (
              <div className="stack">
                <strong className="join-code">{codes.data.code}</strong>
                <p>
                  생성 {formatDate(codes.data.createdAt)}
                  <br />
                  만료 {formatDate(codes.data.expiresAt)}
                </p>
                <div className="heading-actions">
                  <button
                    className="secondary-button"
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
                    className="secondary-button"
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
            onSubmit={(event) => {
              event.preventDefault();
              run(issueCode, '참여 코드를 발급했습니다.');
            }}
          >
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
        </section>
      </div>
    </section>
  );
}
