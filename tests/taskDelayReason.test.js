import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {previewContext, previewRequest, setPreviewRole} from '../src/mock/preview.js';
import {getMockState,resetMockState,saveMockState} from '../src/mock/planned.js';
import {koreanDateTime} from '../src/lib/koreanTime.js';
const storage = new Map();
globalThis.localStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
beforeEach(()=>{
  storage.clear(); setPreviewRole('leader'); const context=previewContext(); resetMockState(context);
  const state=getMockState(context), task=state.teams[1].tasks.find(task=>task.id===102);
  task.dueAt=koreanDateTime(Date.now()-3600000);
  for (const {userId} of task.assignees) task.contributions[userId]='담당한 자료 작성과 검증을 수행했습니다.';
  saveMockState(context,state);
});
const patch=(body)=>previewRequest('/api/tasks/102',{method:'PATCH',body});
test('진행 중 작업의 일정 변경과 할 일 복귀를 거절한다',async()=>{
  const {task}=await previewRequest('/api/tasks/102');
  await assert.rejects(patch({expectedVersion:task.version,status:'TODO'}),{code:'INVALID_REQUEST'});
  await assert.rejects(patch({expectedVersion:task.version,dueAt:koreanDateTime(Date.now()+3600000)}),{code:'TASK_SCHEDULE_LOCKED'});
  assert.equal((await previewRequest('/api/tasks/102')).task.version,task.version);
});
test('지연 사유와 완료를 함께 저장하고 상세에 작성자와 시각을 제공한다',async()=>{
  const {task}=await previewRequest('/api/tasks/102');
  assert.equal(task.completionBlockReason,'DELAY_REASON_REQUIRED');
  await assert.rejects(patch({expectedVersion:task.version,status:'DONE'}),{code:'DELAY_REASON_REQUIRED'});
  await patch({expectedVersion:task.version,status:'DONE',delayReason:'  검증에 시간이 더 필요했습니다.  '});
  const detail=await previewRequest('/api/tasks/102');
  assert.equal(detail.task.status,'DONE'); assert.equal(detail.delayReason.text,'검증에 시간이 더 필요했습니다.');
  assert.equal(detail.delayReason.authorId,previewContext().user.id); assert.ok(detail.delayReason.updatedAt);
  await patch({expectedVersion:detail.task.version,status:'REVISING'});
  assert.deepEqual((await previewRequest('/api/tasks/102')).delayReason,detail.delayReason);
});
test('지연 사유는 공백과 500자 초과를 거절하고 비담당자는 수정할 수 없다',async()=>{
  const {task}=await previewRequest('/api/tasks/102');
  for (const delayReason of [' ', '가'.repeat(501), null]) await assert.rejects(patch({expectedVersion:task.version,delayReason}),{code:'INVALID_REQUEST'});
  const context=previewContext(),state=getMockState(context);
  state.teams[1].tasks.find(task=>task.id===102).assignees=[{userId:state.teams[1].members.find(member=>member.userId!==context.user.id).userId,allocationPercent:100}];
  saveMockState(context,state);
  await assert.rejects(patch({expectedVersion:task.version,delayReason:'사유'}),{code:'FORBIDDEN'});
});
