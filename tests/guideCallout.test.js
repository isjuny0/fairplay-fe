import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideCalloutPosition } from '../src/lib/guideCallout.js';

const viewport = { left: 0, top: 64, right: 1440, bottom: 900 };
const size = { width: 340, height: 200 };
test('말풍선은 오른쪽 여백이 부족하면 왼쪽에 배치한다', () => {
  const anchor = { left: 1300, right: 1340, top: 300, bottom: 340 };
  const result = guideCalloutPosition(anchor, size, viewport);
  assert.equal(result.side, 'left');
  assert.ok(result.x + result.width < anchor.left);
});
test('말풍선은 화면 가장자리와 강조한 대상을 침범하지 않는다', () => {
  for (const x of [12, 600, 1380]) for (const y of [80, 400, 850]) {
    const anchor = { left: x, right: x + 40, top: y, bottom: y + 30 };
    const result = guideCalloutPosition(anchor, size, viewport);
    assert.ok(result);
    assert.ok(result.x >= 12 && result.y >= 76);
    assert.ok(result.x + size.width <= 1428 && result.y + size.height <= 888);
    assert.ok(result.x + size.width <= anchor.left || result.x >= anchor.right
      || result.y + size.height <= anchor.top || result.y >= anchor.bottom);
  }
});
test('큰 강조 영역 주변에 공간이 없으면 겹쳐 표시하지 않는다', () => {
  assert.equal(guideCalloutPosition({ left: 10, top: 75, right: 1430, bottom: 890 }, size, viewport), null);
});

test('화면보다 긴 안내는 높이를 줄여서 배치 가능한 것으로 판단하지 않는다', () => {
  const shortViewport = { left: 0, top: 56, right: 1200, bottom: 240 };
  assert.equal(guideCalloutPosition({ left: 100, right: 150, top: 90, bottom: 125 }, size, shortViewport), null);
});

test('팀 행의 진행률과 작업 현황을 피해 행 위에 안내한다', () => {
  const anchor = { left: 290, right: 510, top: 490, bottom: 525 };
  const row = { left: 280, right: 1380, top: 470, bottom: 580 };
  const result = guideCalloutPosition(anchor, size, viewport, { avoidRect: row, placement: 'vertical' });
  assert.equal(result.side, 'top');
  assert.ok(result.y + size.height <= row.top - 14);
  assert.ok(result.arrow >= 18 && result.arrow <= size.width - 18);
});
test('행 위에 공간이 없으면 행 아래에 안내한다', () => {
  const anchor = { left: 290, right: 510, top: 100, bottom: 130 };
  const row = { left: 280, right: 1380, top: 90, bottom: 200 };
  const result = guideCalloutPosition(anchor, size, viewport, { avoidRect: row, placement: 'vertical' });
  assert.equal(result.side, 'bottom');
  assert.ok(result.y >= row.bottom + 14);
});
test('화면을 채운 팀 카드를 가리면서까지 말풍선을 배치하지 않는다', () => {
  const narrowViewport = { left: 0, top: 56, right: 390, bottom: 600 };
  const anchor = { left: 30, right: 180, top: 110, bottom: 150 };
  const card = { left: 16, right: 374, top: 85, bottom: 590 };
  assert.equal(guideCalloutPosition(anchor, size, narrowViewport, { avoidRect: card, placement: 'vertical' }), null);
});

test('팀 행과 열 제목을 함께 보호하면 표 머리글 위에 안내한다', () => {
  const anchor = { left: 290, right: 510, top: 490, bottom: 525 };
  const rowAndHeading = { left: 280, right: 1380, top: 410, bottom: 580 };
  const result = guideCalloutPosition(anchor, size, viewport, { avoidRect: rowAndHeading, placement: 'vertical' });
  assert.equal(result.side, 'top');
  assert.ok(result.y + size.height < rowAndHeading.top);
});
