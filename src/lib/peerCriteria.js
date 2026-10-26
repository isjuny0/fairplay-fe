export const peerCriteria = {
  taskExecution: '작업 수행',
  responsibility: '책임감',
  collaboration: '적극성',
  communication: '의사소통',
};
export const peerScoreOptions = [
  { score: 1, label: '매우 미흡' },
  { score: 2, label: '미흡' },
  { score: 3, label: '보통' },
  { score: 4, label: '우수' },
  { score: 5, label: '매우 우수' },
];
export const peerCriteriaDescriptions = {
  taskExecution: '담당 작업의 결과가 합의한 요구사항에 맞고, 오류나 누락 없이 활용할 수 있는 수준인지 확인합니다.',
  responsibility: '맡은 역할과 기한을 지키고, 어려움이 생겼을 때 필요한 조치를 취하며 끝까지 마무리했는지 확인합니다.',
  collaboration: '팀 목표를 위해 필요한 일을 스스로 찾고, 개선 의견을 제안하거나 문제 해결에 먼저 참여했는지 확인합니다.',
  communication: '진행 상황과 필요한 정보를 이해하기 쉽게 전달하고, 다른 팀원의 의견과 질문에 적절히 응답했는지 확인합니다.',
};
export const peerGuides = {
  taskExecution: [
    '결과에 중요한 오류·누락이 반복되어 상당한 보완이 필요함',
    '합의한 요구사항을 충족하고 결과를 활용할 수 있음',
    '요구사항을 충족하면서 예외 상황이나 세부 사항까지 검증해 완성도 높은 결과를 제공함',
  ],
  responsibility: [
    '합의한 역할·기한을 반복적으로 지키지 않고 후속 조치도 하지 않음',
    '맡은 역할과 기한을 지키며, 어려움이 생기면 미리 알리고 조정한 약속을 이행함',
    '진행 위험과 남은 일을 꾸준히 점검하고 후속 조치까지 챙겨 약속한 결과를 안정적으로 마무리함',
  ],
  collaboration: [
    '참여할 기회가 있어도 공동 논의나 문제 해결에 반복적으로 참여하지 않음',
    '필요한 일을 스스로 찾아 제안하거나 문제 해결에 자발적으로 참여함',
    '실행 가능한 개선안을 제안하고 직접 참여해 팀의 문제 해결에 실질적인 도움을 줌',
  ],
  communication: [
    '필요한 정보·응답을 반복적으로 누락하거나 불명확하게 전달해 협업에 차질을 줌',
    '필요한 정보를 제때 명확하게 전달하고 질문·의견에 적절히 응답함',
    '복잡하거나 모호한 내용을 정리하고 서로의 이해를 확인해 오해와 재작업을 줄임',
  ],
};

export const peerEvaluationNotes = {
  taskExecution: '작업량이나 기한 준수 여부와 구분해 결과의 품질을 평가하세요.',
  responsibility: '일정 변경을 미리 협의하고 변경한 약속을 지켰다면 지연 사실만으로 감점하지 마세요.',
  collaboration: '리더 역할이나 추가 업무량보다 실제로 자발적으로 참여한 행동을 기준으로 평가하세요.',
  communication: '발언 횟수보다 필요한 정보를 명확하게 전달하고 적절히 응답했는지 평가하세요.',
};

