import { isApprovedMember } from './domain.js';

export const teamNavigationGroups = [
  {
    label: '팀 작업',
    items: [
      ['팀 홈', 'team'],
      ['작업', 'board'],
      ['산출물', 'file'],
      ['팀 자료 검색', 'search'],
    ],
  },
  {
    label: '평가·리포트',
    items: [
      ['동료 평가', 'review'],
      ['중간 피드백', 'feedback'],
      ['기여도 리포트', 'chart'],
    ],
  },
  {
    label: '팀 관리',
    items: [
      ['팀원 관리', 'member'],
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
