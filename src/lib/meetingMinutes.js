import { isValidDate } from "./dateTime.js";

export const meetingLimits = {
  title: 100,
  agenda: 5000,
  content: 20000,
  decisions: 5000,
  attendees: 100,
};
export const meetingSections = [
  ["agenda", "안건"],
  ["content", "논의 내용"],
  ["decisions", "결정사항"],
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validMeetingTime(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value)
  )
    return false;
  return (
    Number(value.slice(0, 4)) >= 1 &&
    isValidDate(value.slice(0, 10)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    (value.length === 16 || Number(value.slice(17, 19)) < 60)
  );
}

export function validateMeetingMinute(input, partial = false) {
  const errors = {};
  if (!input || typeof input !== "object")
    return { title: "회의록 정보를 입력해 주세요." };
  if (!partial || Object.hasOwn(input, "title")) {
    if (
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.trim().length > meetingLimits.title
    )
      errors.title = "제목은 공백을 제외하고 1~100자로 입력해 주세요.";
  }
  if (
    (!partial || Object.hasOwn(input, "meetingAt")) &&
    !validMeetingTime(input.meetingAt)
  )
    errors.meetingAt = "회의일시를 한국 시간으로 입력해 주세요.";
  for (const [field, label] of meetingSections) {
    if (
      Object.hasOwn(input, field) &&
      (typeof input[field] !== "string" ||
        input[field].length > meetingLimits[field])
    )
      errors[field] =
        `${label}은 ${meetingLimits[field].toLocaleString()}자 이내로 입력해 주세요.`;
  }
  if (
    Object.hasOwn(input, "attendeeIds") &&
    (!Array.isArray(input.attendeeIds) ||
      input.attendeeIds.length > 100 ||
      new Set(input.attendeeIds).size !== input.attendeeIds.length ||
      input.attendeeIds.some((id) => typeof id !== "string" || !uuid.test(id)))
  )
    errors.attendeeIds =
      "참석자는 중복 없이 최대 100명까지 선택할 수 있습니다.";
  if (
    partial &&
    ![
      "title",
      "meetingAt",
      "attendeeIds",
      ...meetingSections.map(([key]) => key),
    ].some((key) => Object.hasOwn(input, key))
  )
    errors.title = "수정할 내용을 입력해 주세요.";
  return errors;
}

export function meetingDraft(item) {
  return {
    title: item?.title || "",
    meetingAt: item?.meetingAt?.slice(0, 16) || "",
    attendeeIds: (item?.attendees || []).map((person) => person.userId),
    agenda: item?.agenda || "",
    content: item?.content || "",
    decisions: item?.decisions || "",
  };
}

export function meetingInput(form, initial = null) {
  const original = meetingDraft(initial);
  return Object.fromEntries(
    Object.entries(form)
      .filter(([key, value]) => {
        if (!initial) return true;
        if (key === "attendeeIds")
          return [...value].sort().join() !== [...original[key]].sort().join();
        return value !== original[key];
      })
      .map(([key, value]) => [
        key,
        key === "title"
          ? value.trim()
          : key === "meetingAt" && value.length === 16
            ? `${value}:00`
            : value,
      ]),
  );
}

export const isMeetingConflict = (error) =>
  error?.code === "MEETING_MINUTE_VERSION_CONFLICT";
