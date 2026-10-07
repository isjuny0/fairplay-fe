import { isApprovedMember } from './domain.js';

export const teamNavigationGroups = [
  { label: null, items: [['팀 홈', 'home']] },
  {
    label: '작업',
    items: [
      ['작업 보드', 'board'],
      ['산출물', 'file'],
      ['승인 검토', 'check'],
    ],
  },
  {
    label: '평가',
    items: [
      ['동료 평가', 'users'],
      ['중간 피드백', 'check'],
      ['기여도 리포트', 'file'],
    ],
  },
  {
    label: '팀 관리',
    items: [
      ['팀원 관리', 'users'],
      ['팀 설정', 'settings'],
    ],
  },
];

export function availableTeamMenus(team) {
  return isApprovedMember(team)
    ? teamNavigationGroups.flatMap((group) =>
        group.items.map(([label]) => label),
      )
    : ['팀원 관리', '산출물'];
}
