import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { formatLastSeen } from "../lib/utils";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, isSelectedUserTyping } = useChatStore();
  const { onlineUsers, userPresence } = useAuthStore();

  const isOnline = onlineUsers.includes(selectedUser._id);
  const presence = userPresence[selectedUser._id];
  const lastSeen = presence?.lastSeen || selectedUser.lastSeen || selectedUser.createdAt;
  const formattedLastSeen = formatLastSeen(lastSeen);

  return (
    <div className="px-3 py-2.5 sm:p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info */}
          <div className="min-w-0">
            <h3 className="font-medium truncate max-w-[180px] sm:max-w-none">{selectedUser.fullName}</h3>
            <p className="text-xs sm:text-sm text-base-content/70 truncate max-w-[180px] sm:max-w-none">
              {isSelectedUserTyping
                ? "typing..."
                : isOnline
                  ? "Online"
                  : formattedLastSeen
                    ? `last seen ${formattedLastSeen}`
                    : "last seen unavailable"}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          className="btn btn-circle btn-sm"
          aria-label="Back to contacts"
          onClick={() => setSelectedUser(null)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;
