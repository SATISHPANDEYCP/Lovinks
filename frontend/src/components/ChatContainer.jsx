import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import {
  Check,
  CheckCheck,
  ChevronDown,
  FileAudio,
  FileText,
  FileVideo,
  Lock,
  Loader2,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    markConversationAsRead,
    deleteMessage,
    sendMessage,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    initialUnreadMessageId,
    setInitialUnreadMessageId,
    setActiveChatAtBottom,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageListRef = useRef(null);
  const messageEndRef = useRef(null);
  const documentFrameRef = useRef(null);
  const hasInitializedScrollRef = useRef(false);
  const previousLastMessageIdRef = useRef(null);
  const [stickyUnreadStartId, setStickyUnreadStartId] = useState(null);
  const [unreadStartId, setUnreadStartId] = useState(null);
  const [unreadIncomingCount, setUnreadIncomingCount] = useState(0);
  const [hasUserScrolledUp, setHasUserScrolledUp] = useState(false);
  const [openMenuMessageId, setOpenMenuMessageId] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [documentPreviewProgress, setDocumentPreviewProgress] = useState(0);

  const isNearBottom = () => {
    const container = messageListRef.current;
    if (!container) return true;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < 120;
  };

  useEffect(() => {
    getMessages(selectedUser._id);
    markConversationAsRead(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [
    selectedUser._id,
    getMessages,
    markConversationAsRead,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (!messageEndRef.current || !messages.length) return;

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = String(latestMessage._id);
    const isNewTailMessage = previousLastMessageIdRef.current !== latestMessageId;
    previousLastMessageIdRef.current = latestMessageId;

    if (!isNewTailMessage) return;

    // On first render for a selected chat, always open near latest messages.
    if (!hasInitializedScrollRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "auto" });
      hasInitializedScrollRef.current = true;
      markConversationAsRead(selectedUser._id);
      return;
    }

    const isIncoming = latestMessage.senderId === selectedUser._id;

    if (isNearBottom()) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      if (isIncoming) {
        markConversationAsRead(selectedUser._id);
      }
      setUnreadIncomingCount(0);
      setUnreadStartId(null);
      return;
    }

    if (isIncoming) {
      if (!unreadStartId) {
        setUnreadStartId(latestMessage._id);
      }
      setUnreadIncomingCount((count) => count + 1);
    }
  }, [messages, markConversationAsRead, selectedUser._id, unreadStartId]);

  useEffect(() => {
    if (!initialUnreadMessageId) return;
    setStickyUnreadStartId(initialUnreadMessageId);
    setInitialUnreadMessageId(null);
  }, [initialUnreadMessageId, setInitialUnreadMessageId]);

  useEffect(() => {
    if (!messages.length) return;

    const latestMessage = messages[messages.length - 1];
    const isIncoming = latestMessage.senderId === selectedUser._id;

    if (!isIncoming) return;

    if (hasUserScrolledUp && !unreadStartId) {
      setUnreadStartId(latestMessage._id);
    }
  }, [messages, selectedUser._id, unreadStartId, hasUserScrolledUp]);

  useEffect(() => {
    hasInitializedScrollRef.current = false;
    previousLastMessageIdRef.current = null;
    setUnreadStartId(null);
    setStickyUnreadStartId(null);
    setUnreadIncomingCount(0);
    setHasUserScrolledUp(false);
    setOpenMenuMessageId(null);
    setInitialUnreadMessageId(null);
    setActiveChatAtBottom(true);
  }, [selectedUser._id]);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (!target.closest("[data-message-menu-root='true']")) {
        setOpenMenuMessageId(null);
      }
    };

    const closeMenuOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpenMenuMessageId(null);
        setPreviewImageUrl("");
        setPreviewDocument(null);
      }
    };

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, []);

  const handleMessageScroll = () => {
    if (isNearBottom()) {
      setHasUserScrolledUp(false);
      setUnreadStartId(null);
      setActiveChatAtBottom(true);
      if (unreadIncomingCount > 0) {
        setUnreadIncomingCount(0);
        markConversationAsRead(selectedUser._id);
      }
    } else {
      setHasUserScrolledUp(true);
      setActiveChatAtBottom(false);
    }
  };

  const jumpToLatestMessages = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    setHasUserScrolledUp(false);
    setUnreadStartId(null);
    if (unreadIncomingCount > 0) {
      setUnreadIncomingCount(0);
      markConversationAsRead(selectedUser._id);
    }
  };

  const handleDeleteMessage = async (message, scope) => {
    setOpenMenuMessageId(null);
    await deleteMessage(message, scope);
  };

  const openImagePreview = (imageUrl) => {
    if (!imageUrl) return;
    setPreviewImageUrl(imageUrl);
  };

  const closeImagePreview = () => {
    setPreviewImageUrl("");
  };

  const closeDocumentPreview = () => {
    if (previewDocument?.isBlobUrl) {
      URL.revokeObjectURL(previewDocument.url);
    }
    setPreviewDocument(null);
    setDocumentPreviewProgress(0);
  };

  useEffect(() => {
    if (!previewDocument) return;

    let intervalId;

    const updateProgress = () => {
      try {
        const frameWindow = documentFrameRef.current?.contentWindow;
        const frameDocument = frameWindow?.document;
        if (!frameDocument) return;

        const root = frameDocument.scrollingElement || frameDocument.documentElement;
        if (!root) return;

        const maxScrollable = root.scrollHeight - root.clientHeight;
        if (maxScrollable <= 0) {
          setDocumentPreviewProgress(100);
          return;
        }

        const current = Math.min(maxScrollable, Math.max(0, root.scrollTop));
        const percent = Math.round((current / maxScrollable) * 100);
        setDocumentPreviewProgress(percent);
      } catch {
        // Native browser PDF viewers may block frame access; keep progress neutral.
        setDocumentPreviewProgress(0);
      }
    };

    intervalId = setInterval(updateProgress, 250);
    updateProgress();

    return () => {
      clearInterval(intervalId);
    };
  }, [previewDocument]);

  useEffect(() => {
    if (!previewImageUrl && !previewDocument) return;

    const blockShortcuts = (event) => {
      const key = String(event.key || "").toLowerCase();
      const withCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (withCtrlOrMeta && (key === "s" || key === "p" || key === "u")) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", blockShortcuts);
    return () => document.removeEventListener("keydown", blockShortcuts);
  }, [previewImageUrl, previewDocument]);

  const renderStatusIcon = (message) => {
    if (message.uploadFailed) {
      return <span className="text-[0.6rem] text-red-400">Failed</span>;
    }

    if (message.isUploading) {
      return (
        <span className="inline-flex items-center gap-1 text-[0.6rem] opacity-80">
          <Loader2 className="size-3 animate-spin" />
          {typeof message.uploadProgress === "number" ? `${message.uploadProgress}%` : "Uploading"}
        </span>
      );
    }

    const status = message.status || "sent";

    if (status === "read") {
      return <CheckCheck size={13} className="status-tick-read" />;
    }

    if (status === "delivered") {
      return <CheckCheck size={13} className="status-tick-delivered" />;
    }

    return <Check size={13} className="status-tick-sent" />;
  };

  const handleRetryUpload = (message) => {
    if (!message?._localFileData) return;

    const optimisticMessage = {
      ...message,
      isUploading: true,
      uploadFailed: false,
      uploadProgress: 0,
    };

    sendMessage(
      {
        text: message.text || "",
        file: message._localFileData,
        fileName: message.fileName || "",
        fileType: message.fileType || "",
      },
      {
        tempId: message._id,
        optimisticMessage,
        onProgress: () => {},
      }
    );
  };

  const handleOpenAttachment = async (event, fileUrl, fileName, fileType) => {
    event.preventDefault();
    if (!fileUrl) return;

    // Data URLs (used by encrypted attachments) can fail on direct navigation,
    // so convert to Blob URL for reliable open in a new tab.
    if (fileUrl.startsWith("data:")) {
      try {
        const [metaPart, base64Data] = fileUrl.split(",");
        const mimeMatch = metaPart.match(/data:(.*?);base64/);
        const mimeType = mimeMatch?.[1] || "application/octet-stream";
        const binary = atob(base64Data || "");
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        setPreviewDocument({
          url: blobUrl,
          fileName: fileName || "Attachment",
          fileType: mimeType || fileType || "application/octet-stream",
          isBlobUrl: true,
        });
        return;
      } catch {
        return;
      }
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch attachment");
      }

      const fileBlob = await response.blob();
      const blobUrl = URL.createObjectURL(fileBlob);
      setPreviewDocument({
        url: blobUrl,
        fileName: fileName || "Attachment",
        fileType: fileBlob.type || fileType || "application/octet-stream",
        isBlobUrl: true,
      });
      return;
    } catch {
      setPreviewDocument({
        url: fileUrl,
        fileName: fileName || "Attachment",
        fileType: fileType || "application/octet-stream",
        isBlobUrl: false,
      });
    }
  };

  const renderAttachment = (message) => {
    if (message.image) {
      return (
        <div className="relative mb-2 media-content-wrap">
          <button
            type="button"
            className="message-image-trigger"
            onClick={() => openImagePreview(message.image)}
          >
            <img
              src={message.image}
              alt="Attachment"
              className="message-image"
            />
          </button>
          {message.uploadFailed && (
            <button
              type="button"
              onClick={() => handleRetryUpload(message)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white"
            >
              Retry upload
            </button>
          )}
        </div>
      );
    }

    if (!message.fileUrl) {
      if (!message.fileType) return null;

      const isPdf = message.fileType?.includes("pdf");
      const attachmentLabel = message.fileType?.includes("pdf")
        ? "PDF document"
        : message.fileType?.startsWith("audio/")
          ? "Audio file"
          : message.fileType?.startsWith("video/")
            ? "Video file"
            : "Document";

      return (
        <div className="mb-2 message-document-card">
          <span className={`message-document-icon ${isPdf ? "message-document-icon-pdf" : ""}`}>
            {message.fileType?.startsWith("audio/") ? (
              <FileAudio className="size-4" />
            ) : message.fileType?.startsWith("video/") ? (
              <FileVideo className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </span>

          <span className="message-document-meta">
            <span className="message-document-name">{message.fileName || "Attachment"}</span>
            <span className="message-document-type">{attachmentLabel}</span>
          </span>

          {message.uploadFailed && (
            <button
              type="button"
              onClick={() => handleRetryUpload(message)}
              className="ml-2 text-[0.65rem] text-red-400 underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    if (message.fileType?.startsWith("image/")) {
      return (
        <button
          type="button"
          className="message-image-trigger mb-2"
          onClick={() => openImagePreview(message.fileUrl)}
        >
          <img
            src={message.fileUrl}
            alt={message.fileName || "Attachment"}
            className="message-image"
          />
        </button>
      );
    }

    if (message.fileType?.startsWith("audio/")) {
      return <audio controls src={message.fileUrl} className="mb-2 w-full" />;
    }

    if (message.fileType?.startsWith("video/")) {
      return <video controls src={message.fileUrl} className="mb-2 w-full rounded-md" />;
    }

    const attachmentLabel = message.fileType?.includes("pdf")
      ? "PDF document"
      : message.fileType?.startsWith("audio/")
        ? "Audio file"
        : message.fileType?.startsWith("video/")
          ? "Video file"
          : "Document";

    const isPdf = message.fileType?.includes("pdf");

    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-2 message-document-card message-document-link"
        onClick={(event) =>
          handleOpenAttachment(event, message.fileUrl, message.fileName, message.fileType)
        }
      >
        <span className={`message-document-icon ${isPdf ? "message-document-icon-pdf" : ""}`}>
          {message.fileType?.startsWith("audio/") ? (
            <FileAudio className="size-4" />
          ) : message.fileType?.startsWith("video/") ? (
            <FileVideo className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
        </span>

        <span className="message-document-meta">
          <span className="message-document-name">{message.fileName || "Attachment"}</span>
          <span className="message-document-type">{attachmentLabel}</span>
        </span>
      </a>
    );
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatHeader />

      <div className="relative flex-1 min-h-0">
        <div
          ref={messageListRef}
          onScroll={handleMessageScroll}
          className="h-full overflow-y-auto overflow-x-hidden p-4 space-y-4"
        >
          <div className="e2ee-watermark" role="note" aria-label="End-to-end encryption notice">
            <Lock size={12} />
            <p>
              Messages and calls are end-to-end encrypted. No one outside of this chat, not even
              Lovinks, can read or listen to them.
            </p>
          </div>

          {messages.map((message) => (
            <div key={message._id}>
              {(unreadStartId === message._id || stickyUnreadStartId === message._id) && (
                <div className="unread-divider">
                  <span>New messages</span>
                </div>
              )}

              <div
                className={`chat message-pop ${
                  message.senderId === authUser._id ? "chat-end" : "chat-start"
                }`}
              >
                <div className="message-bubble-wrap" data-message-menu-root="true">
                  <div
                    className={`chat-bubble flex flex-col ${message.text ? "has-text-content" : ""} ${
                      message.image && !message.text ? "has-media-only" : ""
                    }`}
                  >
                    {!message.isUploading && (
                      <button
                        type="button"
                        aria-label="Message options"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuMessageId((currentId) =>
                            currentId === message._id ? null : message._id
                          );
                        }}
                        className={`message-options-trigger ${
                          openMenuMessageId === message._id ? "is-open" : ""
                        }`}
                      >
                        <MoreVertical size={12} />
                      </button>
                    )}

                    {renderAttachment(message)}
                    {message.text && <p className="message-text">{message.text}</p>}

                    <div className={`message-meta ${message.text ? "floating-meta" : ""}`}>
                      <time className="text-[11px] opacity-70">{formatMessageTime(message.createdAt)}</time>
                      {message.senderId === authUser._id && renderStatusIcon(message)}
                    </div>
                  </div>

                  {openMenuMessageId === message._id && (
                    <div
                      className={`message-options-menu ${
                        message.senderId === authUser._id
                          ? "message-options-menu-end"
                          : "message-options-menu-start"
                      }`}
                      role="menu"
                    >
                      <button
                        type="button"
                        aria-label="Close menu"
                        className="message-options-close"
                        onClick={() => setOpenMenuMessageId(null)}
                      >
                        <X size={10} />
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        className="message-options-item"
                        onClick={() => handleDeleteMessage(message, "me")}
                      >
                        <Trash2 size={12} />
                        Delete for me
                      </button>
                      {message.senderId === authUser._id && (
                        <button
                          type="button"
                          role="menuitem"
                          className="message-options-item message-options-item-danger"
                          onClick={() => handleDeleteMessage(message, "everyone")}
                        >
                          <Trash2 size={12} />
                          Delete for everyone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div ref={messageEndRef} />
        </div>

        {hasUserScrolledUp && unreadIncomingCount > 0 && (
          <button
            type="button"
            onClick={jumpToLatestMessages}
            className="btn btn-sm absolute bottom-4 right-4 z-10 shadow-lg"
          >
            <ChevronDown size={14} />
            {unreadIncomingCount} new
          </button>
        )}
      </div>

      {previewImageUrl && (
        <div className="image-preview-overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="image-preview-backdrop"
            aria-label="Close image preview"
            onClick={closeImagePreview}
          />

          <div className="image-preview-content">
            <button
              type="button"
              className="image-preview-close"
              aria-label="Close preview"
              onClick={closeImagePreview}
            >
              <X size={16} />
            </button>

            <img src={previewImageUrl} alt="Preview" className="image-preview-media" />
          </div>
        </div>
      )}

      {previewDocument && (
        <div className="image-preview-overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="image-preview-backdrop"
            aria-label="Close document preview"
            onClick={closeDocumentPreview}
          />

          <div className="document-preview-content" onContextMenu={(event) => event.preventDefault()}>
            <button
              type="button"
              className="image-preview-close"
              aria-label="Close preview"
              onClick={closeDocumentPreview}
            >
              <X size={16} />
            </button>

            <div className="document-preview-header">
              <span className="document-preview-name">{previewDocument.fileName}</span>
              <span className="document-preview-lock">Protected preview</span>
            </div>

            <div className="document-preview-progress-track" aria-hidden="true">
              <span
                className="document-preview-progress-fill"
                style={{ width: `${documentPreviewProgress}%` }}
              />
            </div>

            {(() => {
              const isPdf =
                previewDocument.fileType?.includes("pdf") ||
                /\.pdf$/i.test(previewDocument.fileName || "");
              const frameSrc = isPdf
                ? `${previewDocument.url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=FitH`
                : previewDocument.url;

              return (
                <iframe
                  ref={documentFrameRef}
                  title={previewDocument.fileName}
                  src={frameSrc}
                  className="document-preview-frame"
                />
              );
            })()}
          </div>
        </div>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
