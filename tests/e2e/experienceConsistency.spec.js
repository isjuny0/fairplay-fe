import {test, expect} from '@playwright/test';
import {selectPreviewOption} from './helpers/previewControls.js';
const team='/preview/spaces/1/teams/1';

for(const width of [320,390,1440]) {
  test(`${width}px: 메뉴에서 회의록으로 이동하고 현재 위치를 확인한다`,async({page},info)=>{
    await page.setViewportSize({width,height:844});
    await page.goto(`${team}/tasks`);
    if(width<721) {
      await expect(page.getByRole('navigation',{name:'모바일 팀 메뉴'})).toBeHidden();
      await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
    }
    const navigation=page.getByRole('navigation',{name:'팀 메뉴',exact:true});
    await navigation.getByRole('button',{name:'회의록',exact:true}).click();
    await expect(page).toHaveURL(/meeting-minutes$/);
    await expect(page.getByRole('heading',{name:'팀 회의록',exact:true})).toBeVisible();
    if(width<721) {
      await expect(page.locator('.mobile-space-toggle')).toHaveAttribute('title', '회의록 · 메뉴 열기');
      await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
      await expect(navigation.getByRole('button',{name:'회의록',exact:true})).toHaveAttribute('aria-current','page');
      await page.screenshot({path:info.outputPath('unified-menu-open.png'),animations:'disabled'});
      await navigation.getByRole('button',{name:'회의록',exact:true}).press('Escape');
      await expect(page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true})).toBeFocused();
    }
    await page.screenshot({path:info.outputPath('navigation.png'),animations:'disabled'});
  });
  test(`${width}px: 산출물 필터를 접어도 조건을 확인하고 해제할 수 있다`,async({page},info)=>{
    await page.setViewportSize({width,height:844});
    await page.goto(`${team}/deliverables`);
    const type=page.getByLabel('자료 유형',{exact:true});
    const toggle=page.getByRole('button',{name:/^필터.*펼치기$/});
    await expect(type).toBeHidden();
    await toggle.click();
    await type.selectOption('FILE');
    await expect(page).toHaveURL(/type=FILE/);
    await page.getByRole('button',{name:/^필터.*접기$/}).click();
    const chip=page.getByRole('button',{name:'유형: 파일 조건 해제',exact:true});
    await expect(chip).toBeVisible();await chip.click();
    await expect(page).not.toHaveURL(/type=FILE/);
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('deliverable-filters.png'),animations:'disabled'});
  });
  test(`${width}px: 작업을 저장하기 전 제목과 담당 배분을 검토한다`,async({page})=>{
    await page.setViewportSize({width,height:844});await page.goto(`${team}/tasks`);
    await page.getByRole('button',{name:'새 작업 만들기',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'새 작업 만들기',exact:true});
    await dialog.getByLabel('작업 제목',{exact:true}).fill('회의 결과 공유');
    await dialog.getByLabel('작업 설명',{exact:true}).fill('회의에서 결정한 내용을 팀원에게 공유합니다.');
    await dialog.getByRole('button',{name:'다음',exact:true}).click();
    await dialog.getByRole('button',{name:'다음',exact:true}).click();
    const review=dialog.getByRole('region',{name:'등록 전 확인',exact:true});
    await expect(review).toContainText('회의 결과 공유');
    await expect(review).toContainText('담당자를 선택해 주세요.');
    await expect(dialog.getByRole('button',{name:'저장',exact:true})).toBeVisible();
  });
}

test('390px: 삭제할 수 없는 참여자는 버튼 근처에서 이유를 확인한다',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('fairplay:preview-role','manager'));
  await page.goto('/preview/spaces/1/participants');
  const row=page.locator('.participant-table tbody tr').first();
  await row.getByText('가입 정보·관리').click();
  const details = row.locator('.participant-mobile-details');
  const button=details.getByRole('button');await expect(button).toBeDisabled();
  await button.focus();
  await expect(page.getByRole('tooltip')).toContainText('스페이스 관리자와 본인은 삭제할 수 없습니다.');
  await expect(button).toHaveAttribute('aria-describedby', /.+/);
});

test('390px: 공지 검색 범위와 알림 읽음 처리 결과를 확인한다',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/preview/spaces/1/announcements');
  await page.getByRole('searchbox').focus();
  await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', '현재 페이지의 제목·작성자 검색');
  await page.goto('/preview/notifications');
  await page.getByRole('button',{name:/읽음으로 표시$/}).first().click();
  await expect(page.getByText('알림을 읽음으로 표시했습니다.',{exact:true})).toBeVisible();
});

test('모바일에서는 작업 목록 대신 타임라인을 표시한다',async({page})=>{
  await page.setViewportSize({width:320,height:844});await page.goto(`${team}/tasks?view=list`);
  await expect(page).toHaveURL(/view=timeline/);
  await expect(page.getByRole('region',{name:'작업 표',exact:true})).toHaveCount(0);
  await expect(page.getByRole('group',{name:'타임라인 상태 필터'})).toBeVisible();
});

test('모바일 공개 리포트는 점수와 항목별 결과를 먼저 보여주고 계산 내역을 펼친다',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/preview/main');
  await selectPreviewOption(page,'미리보기 상황','published');await page.goto(`${team}/reports`);
  const calculation=page.locator('.report-calculation-details').first();
  await expect(calculation).toBeVisible();await expect(calculation).not.toHaveAttribute('open');
  await expect(page.locator('.peer-criteria-scores').first()).toBeVisible();
  await calculation.locator('summary').click();await expect(calculation).toHaveAttribute('open','');
  await expect(calculation.locator('.report-visual-breakdown')).toBeVisible();
  await page.screenshot({path:info.outputPath('report.png'),fullPage:true,animations:'disabled'});
});

test('관리자는 평가 진행 단계와 접히지 않는 리포트 비중 설정을 확인한다',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('fairplay:preview-role','manager'));
  await page.goto('/preview/spaces/1/rounds');
  await expect(page.getByRole('region',{name:'중간 평가 운영',exact:true})).toContainText('평가 종료');
  await expect(page.getByRole('list',{name:'중간 평가 진행 단계',exact:true})).toHaveCount(0);
  await page.goto('/preview/spaces/1/reports');
  await expect(page.getByRole('list', { name: '리포트 처리 단계', exact: true })).toHaveCount(0);
  await expect(page.locator('.report-batch-generation .workflow-next-action')).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: '작업 점수 평가 비중', exact: true })).toBeVisible();
});
