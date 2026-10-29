import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import {
  createSpaceAnnouncement,
  getSpaceAnnouncement,
  updateSpaceAnnouncement,
} from "../api/spaceAnnouncements.js";
import {
  announcementLimits,
  isAnnouncementConflict,
  validateAnnouncement,
} from "../lib/spaceAnnouncements.js";
import { useInteractions } from "../hooks/useInteractions.js";
import { ErrorNotice, Field, FormActions, Modal } from "./ui.jsx";
import SaveRecovery from "./SaveRecovery.jsx";

export default function AnnouncementEditor({
  spaceId,
  announcement = null,
  onClose,
  onSaved,
}) {
  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [pinned, setPinned] = useState(announcement?.pinned || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [recovery, setRecovery] = useState({
    latest: null,
    loading: false,
    loadError: null,
  });
  const titleInput = useRef(null),
    contentInput = useRef(null);
  const active = useRef(true);
  const { confirm, clearChanges } = useInteractions();
  const dirty =
    title.trim() !== (announcement?.title || "") ||
    content.trim() !== (announcement?.content || "") ||
    pinned !== (announcement?.pinned || false);
  const conflict = isAnnouncementConflict(error);
  const blocked =
    [403, 404].includes(error?.status) ||
    [403, 404].includes(recovery.loadError?.status);
  useEffect(() => {
    active.current = true;
    titleInput.current?.focus();
    return () => {
      active.current = false;
    };
  }, []);
  const loadLatest = async () => {
    setRecovery((current) => ({ ...current, loading: true, loadError: null }));
    try {
      const latest = await getSpaceAnnouncement(spaceId, announcement.id);
      if (latest.spaceId !== spaceId)
        throw new ApiError(403, {
          code: "FORBIDDEN",
          message: "이 스페이스의 공지가 아닙니다.",
        });
      setRecovery({ latest, loading: false, loadError: null });
    } catch (loadError) {
      setRecovery({ latest: null, loading: false, loadError });
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || blocked || recovery.loading || (conflict && !recovery.latest))
      return;
    const input = { title: title.trim(), content: content.trim(), pinned };
    const invalid = validateAnnouncement(input);
    setValidation(invalid);
    if (invalid) {
      (invalid.field === "title" ? titleInput : contentInput).current?.focus();
      return;
    }
    setBusy(true);
    try {
      if (
        conflict &&
        !(await confirm({
          title: "최신 내용에 내 수정 반영",
          message:
            "서버의 최신 제목·본문·중요 여부를 작성 중인 내용으로 변경합니다. 비교한 내용을 확인했나요?",
          label: "내 내용으로 저장",
          neutral: true,
        }))
      )
        return;
      const saved = announcement
        ? await updateSpaceAnnouncement(spaceId, announcement.id, {
            ...input,
            expectedVersion: conflict
              ? recovery.latest.version
              : announcement.version,
          })
        : await createSpaceAnnouncement(spaceId, input);
      if (!active.current) return;
      clearChanges();
      onSaved(saved);
    } catch (saveError) {
      setError(saveError);
      setRecovery({ latest: null, loading: false, loadError: null });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={announcement ? "공지 수정" : "공지 작성"}
      onClose={onClose}
      busy={busy || recovery.loading}
      dirty={dirty}
      wide
      editor
    >
      <form className="stack announcement-editor" onSubmit={submit}>
        <ErrorNotice error={error} />
        <Field
          label="공지 제목"
          error={validation?.field === "title" ? validation.message : undefined}
        >
          <input
            ref={titleInput}
            required
            maxLength={announcementLimits.title}
            value={title}
            disabled={busy}
            onChange={(event) => {
              setTitle(event.target.value);
              setValidation(null);
            }}
          />
        </Field>
        <Field
          label="공지 본문"
          error={
            validation?.field === "content" ? validation.message : undefined
          }
        >
          <textarea
            ref={contentInput}
            required
            rows={10}
            maxLength={announcementLimits.content}
            value={content}
            disabled={busy}
            onChange={(event) => {
              setContent(event.target.value);
              setValidation(null);
            }}
          />
        </Field>
        <div className="announcement-editor-options">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={pinned}
              disabled={busy}
              onChange={(event) => setPinned(event.target.checked)}
            />
            중요 공지
          </label>
          <span className="field-help">
            {content.length.toLocaleString()} / 5,000자
          </span>
        </div>
        <SaveRecovery
          error={error}
          recovery={recovery}
          onLoadLatest={conflict ? loadLatest : undefined}
          canReapply={!blocked}
          rows={[
            {
              label: "제목",
              latest: recovery.latest?.title,
              input: title.trim(),
            },
            {
              label: "본문",
              latest: recovery.latest?.content,
              input: content.trim(),
            },
            {
              label: "중요 여부",
              latest: recovery.latest?.pinned ? "중요" : "일반",
              input: pinned ? "중요" : "일반",
            },
          ]}
        />
        <FormActions
          busy={busy || recovery.loading}
          onCancel={onClose}
          disabled={blocked || !dirty || (conflict && !recovery.latest)}
          label={announcement ? "공지 수정 저장" : "공지 등록"}
        />
      </form>
    </Modal>
  );
}
