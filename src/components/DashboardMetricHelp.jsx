import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Modal } from './ui.jsx';

export default function DashboardMetricHelp({ title, contribution = false, weights }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="dashboard-metric-info"
        aria-label={`${title} 계산 기준`}
        title={`${title} 계산 기준`}
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={15} />
      </button>
      {open && (
        <Modal title={`${title} 계산 기준`} onClose={() => setOpen(false)}>
          <div className="dashboard-metric-explanation home-definition-body">
            {contribution ? (
              <>
                <p>
                  공개된 기여도 리포트에 있는 <strong>내 종합점수</strong>
                  이에요.
                </p>
                <dl>
                  <div>
                    <dt>작업 점수{weights && ` · ${weights.taskPercent}%`}</dt>
                    <dd>
                      팀 평균 완료 작업량을 충족하면 100점이며 담당 비율을 반영합니다.
                    </dd>
                  </div>
                  <div>
                    <dt>중간 동료 평가{weights && ` · ${weights.midPercent}%`}</dt>
                    <dd>받은 네 항목의 절대 평균을 100점으로 환산</dd>
                  </div>
                  <div>
                    <dt>최종 동료 평가{weights && ` · ${weights.finalPercent}%`}</dt>
                    <dd>받은 네 항목의 절대 평균을 100점으로 환산</dd>
                  </div>
                </dl>
                <p>
                  리포트가 공개되기 전에는 ‘공개 대기’로 표시해요. 현재 작업의
                  담당 비중·완료 비중과는 다른 결과입니다.
                </p>
              </>
            ) : (
              <>
                <p>
                  작업 개수가 아닌 <strong>예상 작업량</strong>을 기준으로
                  계산해요. 내 분량에는 공동 작업의 담당 비율도 반영합니다.
                </p>
                <dl>
                  {[
                    [
                      '팀 전체 진행률',
                      '팀 전체 일 중 얼마나 끝났는지',
                      '팀 완료 분량 ÷ 팀 전체 분량 × 100',
                    ],
                    [
                      '내 담당 비중',
                      '팀 전체 기준으로 내가 맡은 몫',
                      '내 담당 분량 ÷ 팀 전체 분량 × 100',
                    ],
                    [
                      '내 완료 비중',
                      '팀 전체 기준으로 내가 완료한 몫',
                      '내 완료 분량 ÷ 팀 전체 분량 × 100',
                    ],
                    [
                      '내 작업 완료율',
                      '내가 맡은 일 중 얼마나 끝냈는지',
                      '내 완료 분량 ÷ 내 담당 분량 × 100',
                    ],
                  ].map(([label, meaning, formula]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {meaning}
                        <small>{formula}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  ‘완료’ 작업만 포함하며, 완료 후 ‘수정 중’인 작업은 제외해요.
                  계산할 분량이 없으면 0% 대신 ‘계산할 작업 없음’ 또는 ‘담당
                  작업 없음’으로 표시해요.
                </p>
                <p>
                  현재 작업 현황으로, 실제 소요 시간이나 최종 기여도 점수,
                  무임승차 여부를 뜻하지 않아요.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
