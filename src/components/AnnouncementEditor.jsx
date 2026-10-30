import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import {
  createSpaceAnnouncement,
  deleteSpaceAnnouncementAttachment,
  getSpaceAnnouncement,
  uploadSpaceAnnouncementAttachment,
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
  const [workingAnnouncement, setWorkingAnnouncement] = useState(announcement);
  const [files, setFiles] = useState([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
  const [fileValidation, setFileValidation] = useState("");
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
    title.trim() !== (workingAnnouncement?.title || "") ||
    content.trim() !== (workingAnnouncement?.content || "") ||
    pinned !== (workingAnnouncement?.pinned || false) ||
    files.length > 0 || removedAttachmentIds.length > 0;
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
      const latest = await getSpaceAnnouncement(spaceId, workingAnnouncement.id);
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
      let current = conflict ? recovery.latest : workingAnnouncement;
      if (conflict) setWorkingAnnouncement(current);
      if (!current) {
        current = await createSpaceAnnouncement(spaceId, input);
        setWorkingAnnouncement(current);
      } else if (
        input.title !== current.title ||
        input.content !== current.content ||
        input.pinned !== current.pinned
      ) {
        current = await updateSpaceAnnouncement(spaceId, current.id, {
          ...input,
          expectedVersion: current.version,
        });
        setWorkingAnnouncement(current);
      }
      for (const attachmentId of removedAttachmentIds) {
        if (!(current.attachments || []).some((item) => item.id === attachmentId))
          continue;
        await deleteSpaceAnnouncementAttachment(
          spaceId,
          current.id,
          attachmentId,
          current.version,
        );
        setRemovedAttachmentIds((items) => items.filter((id) => id !== attachmentId));
        current = {
          ...current,
          version: current.version + 1,
          attachments: current.attachments.filter((item) => item.id !== attachmentId),
        };
        setWorkingAnnouncement(current);
        current = await getSpaceAnnouncement(spaceId, current.id);
        setWorkingAnnouncement(current);
      }
      for (const file of files) {
        current = await uploadSpaceAnnouncementAttachment(
          spaceId,
          current.id,
          current.version,
          file,
        );
        setWorkingAnnouncement(current);
        setFiles((items) => items.filter((item) => item !== file));
      }
      if (!active.current) return;
      clearChanges();
      onSaved(current);
    } catch (saveError) {
      setError(saveError);
      setRecovery({ latest: null, loading: false, loadError: null });
    } finally {
      setBusy(false);
    }
  };
  const addFiles = (selection) => {
    const incoming = Array.from(selection || []);
    const allowed = /\.(txt|md|pdf|doc|docx|ppt|pptx|xls|xlsx)$/i;
    const currentCount = (workingAnnouncement?.attachments || []).filter(
      (item) => !removedAttachmentIds.includes(item.id),
    ).length;
    const error = incoming.find((file) => !allowed.test(file.name))
      ? "TXT, MD, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX 파일만 첨부할 수 있습니다."
      : incoming.find((file) => file.size > 10 * 1024 * 1024)
        ? "첨부파일은 파일당 10MiB 이하여야 합니다."
        : currentCount + files.length + incoming.length > 10
          ? "공지 하나에 첨부파일을 최대 10개까지 등록할 수 있습니다."
          : "";
    setFileValidation(error);
    if (!error) setFiles((items) => [...items, ...incoming]);
  };
  return (
    <Modal
      title={workingAnnouncement ? "공지 수정" : "공지 작성"}
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
        <Field
          label="첨부파일"
          error={fileValidation || undefined}
          help="TXT, MD, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX 파일을 공지당 최대 10개까지 첨부할 수 있습니다. 파일당 최대 10MiB입니다."
        >
          <div className="announcement-attachment-picker">
            <input
              type="file"
              multiple
              accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              disabled={busy}
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {((workingAnnouncement?.attachments || []).length > 0 || files.length > 0) && (
              <ul className="announcement-editor-attachments">
                {(workingAnnouncement?.attachments || []).map((attachment) => {
                  const marked = removedAttachmentIds.includes(attachment.id);
                  return (
                    <li key={attachment.id}>
                      <span>{attachment.originalFilename}</span>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        aria-pressed={marked}
                        onClick={() => setRemovedAttachmentIds((items) => marked
                          ? items.filter((id) => id !== attachment.id)
                          : [...items, attachment.id])}
                      >{marked ? "삭제 취소" : "삭제 예정"}</button>
                    </li>
                  );
                })}
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>{file.name} · 업로드 예정</span>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => setFiles((items) => items.filter((item) => item !== file))}
                    >제거</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
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
          label={workingAnnouncement ? "공지 수정 저장" : "공지 등록"}
        />
      </form>
    </Modal>
  );
}
