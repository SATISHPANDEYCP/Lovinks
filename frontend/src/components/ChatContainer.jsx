import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Check, CheckCheck, ChevronDown, FileAudio, FileText, FileVideo, Loader2 } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    markConversationAsRead,
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
  const hasInitializedScrollRef = useRef(false);
  const previousLastMessageIdRef = useRef(null);
  const [stickyUnreadStartId, setStickyUnreadStartId] = useState(null);
  const [unreadStartId, setUnreadStartId] = useState(null);
  const [unreadIncomingCount, setUnreadIncomingCount] = useState(0);
  const [hasUserScrolledUp, setHasUserScrolledUp] = useState(false);

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
    setInitialUnreadMessageId(null);
    setActiveChatAtBottom(true);
  }, [selectedUser._id]);

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

  const renderAttachment = (message) => {
    if (message.image) {
      return (
        <div className="relative mb-2">
          <img
            src={message.image}
            alt="Attachment"
            className="sm:max-w-[200px] rounded-md"
          />
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

      return (
        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-base-300 px-3 py-2 text-sm">
          {message.fileType?.startsWith("audio/") ? (
            <FileAudio className="size-4" />
          ) : message.fileType?.startsWith("video/") ? (
            <FileVideo className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
          <span className="truncate max-w-[180px]">
            {message.fileName || "Attachment"}
          </span>
          {message.uploadFailed && (
            <button
              type="button"
              onClick={() => handleRetryUpload(message)}
              className="ml-2 text-[0.6rem] text-red-400 underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    if (message.fileType?.startsWith("image/")) {
      return (
        <img
          src={message.fileUrl}
          alt={message.fileName || "Attachment"}
          className="sm:max-w-[200px] rounded-md mb-2"
        />
      );
    }

    if (message.fileType?.startsWith("audio/")) {
      return <audio controls src={message.fileUrl} className="mb-2 w-full" />;
    }

    if (message.fileType?.startsWith("video/")) {
      return <video controls src={message.fileUrl} className="mb-2 w-full rounded-md" />;
    }

    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-2 inline-flex items-center gap-2 rounded-md border border-base-300 px-3 py-2 text-sm"
      >
        {message.fileType?.includes("pdf") ? (
          <FileText className="size-4" />
        ) : (
          <FileText className="size-4" />
        )}
        <span className="truncate max-w-[180px]">
          {message.fileName || "Attachment"}
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
          className="h-full overflow-y-auto p-4 space-y-4"
        >
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
                <div className={`chat-bubble flex flex-col ${message.text ? "has-text-content" : ""}`}>
                  {renderAttachment(message)}
                  {message.text && <p className="message-text">{message.text}</p>}

                  <div className={`message-meta ${message.text ? "floating-meta" : ""}`}>
                    <time className="text-[11px] opacity-70">{formatMessageTime(message.createdAt)}</time>
                    {message.senderId === authUser._id && renderStatusIcon(message)}
                  </div>
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

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
