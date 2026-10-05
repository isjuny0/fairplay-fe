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
  buildingLabels,
  formatDate,
  fromDateInput,
  toDateInput,
} from '../lib/domain.js';
import { ErrorNotice, Field, FormActions, ResourceState } from './ui.jsx';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
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
    if (opensAt >= closesAt) {
      setError(new Error('종료 시각은 시작 시각보다 늦어야 합니다.'));
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
      <section className="panel">
        <h2>팀 빌딩 기간</h2>
        <p className="field-help">
          팀 생성·가입 신청·가입 승인은 이 기간 안에서 가능합니다. 모든 시각은
          한국 시간입니다.
        </p>
        <form onSubmit={savePeriod}>
          <fieldset
            className="form-fields"
            disabled={busy || space.teamBuildingStatus === 'LOCKED'}
          >
            <Field label="팀 빌딩 시작">
              <input
                required
                type="datetime-local"
                value={opensAt}
                onChange={(event) => setOpensAt(event.target.value)}
              />
            </Field>
            <Field label="팀 빌딩 종료">
              <input
                required
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
              />
            </Field>
            <FormActions busy={busy} />
          </fieldset>
        </form>
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
                  onClick={() => {
                    if (window.confirm('현재 코드를 철회할까요?'))
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
            run(
              () =>
                codes.data
                  ? rotateJoinCode(space.id, Number(minutes))
                  : createJoinCode(space.id, Number(minutes)),
              '참여 코드를 발급했습니다.',
            );
          }}
        >
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
          <FormActions
            busy={busy || codes.loading || Boolean(codes.error)}
            label={codes.data ? '재발급' : '최초 발급'}
          />
        </form>
        {!codes.data && (
          <div>
            <p className="field-help">
              기존 코드가 만료된 경우 재발급해 주세요.
            </p>
            <button
              className="secondary-button"
              disabled={
                busy ||
                codes.loading ||
                Boolean(codes.error) ||
                Number(minutes) < 1 ||
                Number(minutes) > 10080
              }
              onClick={() =>
                run(
                  () => rotateJoinCode(space.id, Number(minutes)),
                  '참여 코드를 재발급했습니다.',
                )
              }
            >
              만료 코드 재발급
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
