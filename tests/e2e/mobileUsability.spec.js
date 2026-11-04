import { test, expect } from '@playwright/test';
import { selectPreviewOption } from './helpers/previewControls.js';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

const team = '/preview/spaces/1/teams/1';
const memberRoutes = ['/preview/login', '/preview/main', '/preview/notifications', '/preview/spaces/1', '/preview/spaces/1/announcements', '/preview/spaces/1/announcements/1', ...['', 'tasks', 'tasks/102', 'deliverables', 'meeting-minutes', 'meeting-minutes/1', 'materials-search', 'members', 'settings', 'peer-evaluations', 'mid-feedback', 'reports'].map(segment => `${team}${segment ? `/${segment}` : ''}`)];
const managerRoutes = ['dashboard', 'participants', 'rounds', 'reports', 'settings', 'manager/teams/1/members/00000000-0000-4000-8000-000000000001'].map(segment => `/preview/spaces/1/${segment}`);

for (const width of [320, 390, 768]) {
  for (const [role, routes] of [['leader', memberRoutes], ['member', memberRoutes], ['manager', managerRoutes]]) {
    test(`${width}px ${role}: 모든 화면이 화면 폭 안에 표시된다`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(role => localStorage.setItem('fairplay:preview-role', role), role);
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByText('화면을 불러오지 못했습니다.', { exact: true })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const viewport of [{width:320,height:740}, {width:390,height:844}, {width:640,height:360}]) {
  test(`${viewport.width}x${viewport.height}: 할 일 카드와 알림 팝업이 화면 안에 머문다`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/preview/main');
    await page.getByRole('button', { name: '할 일', exact: true }).click();
    const popover = page.getByRole('region', {name:'할 일 미리보기'});
    const cards = popover.locator('.header-task-preview-card');
    await expect(cards.first()).toBeVisible();
    const bounds = await popover.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    const clipped = await cards.evaluateAll(elements => elements.some(element => {
      const card = element.getBoundingClientRect(), container = element.closest('.header-task-preview-cards').getBoundingClientRect();
      return card.left < container.left - 1 || card.right > container.right + 1;
    }));
    expect(clipped).toBe(false);
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name:'알림함',exact:true}).click();
    const notification = await page.getByRole('region',{name:'최근 알림'}).boundingBox();
    expect(notification.y + notification.height).toBeLessThanOrEqual(viewport.height);
  });
}

test('320px: 타임라인 날짜 막대가 고정 작업명 옆에서 보이고 가로로 이동할 수 있다', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.goto(`${team}/tasks`);
  await page.getByRole('button',{name:'타임라인',exact:true}).click();
  const region = page.getByRole('region',{name:'작업 계획 타임라인'});
  const width = await region.evaluate(element => {
    const label = element.querySelector('.timeline-task-label').getBoundingClientRect();
    return {viewport:element.clientWidth,label:label.width,content:element.scrollWidth};
  });
  expect(width.viewport - width.label).toBeGreaterThan(100);
  expect(width.content).toBeGreaterThan(width.viewport);
  await region.evaluate(element => {element.scrollLeft = 200;});
  expect(await region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
});

test('390px: 알림함에서 모바일 메뉴를 펼치면 이전 팀 메뉴로 돌아갈 수 있다', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${team}/tasks`);
  await expect(page.getByRole('heading',{name:'작업',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'알림함',exact:true}).click();
  await page.getByRole('button',{name:'전체 보기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'알림함',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'스페이스 메뉴 펼치기'}).click();
  const navigation=page.getByRole('navigation',{name:'팀 메뉴',exact:true});
  await expect(navigation.getByRole('button',{name:'팀 홈',exact:true})).toBeVisible();
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(0);
  await navigation.getByRole('button',{name:'팀 자료',exact:true}).click();
  await expect(page).toHaveURL(/\/deliverables$/);
});

test('320px: 공지 작성자와 날짜가 서로의 칸을 압축하지 않는다', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.goto('/preview/spaces/1/announcements/1');
  const metadata = page.locator('.announcement-metadata');
  await expect(metadata).toBeVisible();
  await expect(metadata).toHaveCSS('display','grid');
  const rows = await metadata.locator(':scope > div').evaluateAll(elements => elements.map(element=>element.getBoundingClientRect().toJSON()));
  expect(rows[1].y).toBeGreaterThanOrEqual(rows[0].bottom);
  const author = metadata.locator('strong');
  const dimensions = await author.evaluate(element=>({height:element.getBoundingClientRect().height,line:parseFloat(getComputedStyle(element).lineHeight)}));
  expect(dimensions.height).toBeLessThan(dimensions.line * 1.5);
});

test('390px: 작성 창 입력은 확대 없이 읽을 수 있고 주요 버튼을 누를 수 있다', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${team}/meeting-minutes`);
  await page.getByRole('button',{name:'회의록 등록',exact:true}).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox').first();
  await expect(input).toHaveCSS('font-size','16px');
  const save = dialog.getByRole('button',{name:'등록',exact:true});
  await expect(save).toBeInViewport();
  expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

for (const width of [320,390]) {
  test(`${width}px: 공개된 기여도 리포트의 점수와 표를 읽을 수 있다`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:844});
    await page.goto('/preview/main');
    await selectPreviewOption(page,'미리보기 상황','published');
    await page.goto(`${team}/reports`);
    await expect(page.locator('.peer-criteria-scores').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('mobile-published-report.png'),fullPage:true,animations:'disabled'});
  });
  test(`${width}px: 팀 캘린더 날짜 선택과 일정 저장 창이 화면 안에서 동작한다`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:740});
    await page.goto(team);
    await openCalendarEventEditor(page);
    const dialog=page.getByRole('dialog',{name:'일정 추가',exact:true});
    await expect(dialog.getByRole('button',{name:'일정 저장',exact:true})).toBeInViewport();
    await dialog.getByRole('button',{name:'날짜 선택',exact:true}).click();
    const picker=page.getByRole('region',{name:'날짜 선택',exact:true});
    await expect(picker).toBeVisible();
    const bounds=await picker.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:testInfo.outputPath('mobile-calendar-picker.png'),animations:'disabled'});
  });
}
