import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Check, CheckCheck } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    markConversationAsRead,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageListRef = useRef(null);
  const messageEndRef = useRef(null);
  const [unreadStartId, setUnreadStartId] = useState(null);
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
    if (messageEndRef.current && messages && isNearBottom()) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "auto" });
    }
    setUnreadStartId(null);
    setHasUserScrolledUp(false);
  }, [selectedUser._id]);

  const handleMessageScroll = () => {
    if (isNearBottom()) {
      setHasUserScrolledUp(false);
      setUnreadStartId(null);
    } else {
      setHasUserScrolledUp(true);
    }
  };

  const renderStatusIcon = (message) => {
    const status = message.status || "sent";

    if (status === "read") {
      return <CheckCheck size={13} className="status-tick-read" />;
    }

    if (status === "delivered") {
      return <CheckCheck size={13} className="status-tick-delivered" />;
    }

    return <Check size={13} className="status-tick-sent" />;
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div
        ref={messageListRef}
        onScroll={handleMessageScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div key={message._id}>
            {unreadStartId === message._id && (
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
                {message.image && (
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="sm:max-w-[200px] rounded-md mb-2"
                  />
                )}
                {message.text && <p>{message.text}</p>}

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

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
