import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { FileAudio, FileText, FileVideo, Loader2, Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const { sendMessage, selectedUser } = useChatStore();
  const { socket, authUser } = useAuthStore();

  const emitStopTyping = () => {
    if (!socket || !selectedUser || !isTypingRef.current) return;
    socket.emit("stopTyping", { to: selectedUser._id, from: authUser?._id });
    isTypingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitStopTyping();
    };
  }, [socket, selectedUser]);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (!socket || !selectedUser || !authUser) return;

    if (!value.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitStopTyping();
      return;
    }

    if (!isTypingRef.current) {
      socket.emit("typing", { to: selectedUser._id, from: authUser._id });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 1200);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const nextFileType = file.type || "application/octet-stream";
    const isAllowedType = nextFileType.startsWith("image/") || nextFileType === "application/pdf";

    if (!isAllowedType) {
      toast.error("Only image and PDF files are allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFileName(file.name);
    setFileType(nextFileType);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileData(reader.result);
      if (nextFileType.startsWith("image/")) {
        setImagePreview(reader.result);
      } else {
        setImagePreview(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileData(null);
    setFileName("");
    setFileType("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSending) return;
    const trimmedText = text.trim();
    const hasAttachment = Boolean(fileData || imagePreview);
    if (!trimmedText && !hasAttachment) return;

    const tempId = hasAttachment ? `temp-${Date.now()}` : null;
    const optimisticMessage = hasAttachment
      ? {
          _id: tempId,
          senderId: authUser?._id,
          receiverId: selectedUser?._id,
          text: trimmedText,
          image: imagePreview || "",
          fileUrl: "",
          fileType,
          fileName,
          _localFileData: fileData || imagePreview,
          createdAt: new Date().toISOString(),
          status: "sent",
          isUploading: true,
          uploadProgress: 0,
        }
      : null;

    try {
      setIsSending(true);
      if (fileData || imagePreview) setIsUploading(true);
      await sendMessage({
        text: trimmedText,
        file: fileData || imagePreview,
        fileName,
        fileType,
      },
      {
        tempId,
        optimisticMessage,
        onProgress: () => {},
      });

      // Clear form
      setText("");
      setFileData(null);
      setFileName("");
      setFileType("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitStopTyping();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  return (
    <div className="w-full p-2.5 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] border-t border-base-300 bg-base-100/80 backdrop-blur">
      {(imagePreview || fileData) && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2">
                {fileType.startsWith("audio/") ? (
                  <FileAudio className="size-4" />
                ) : fileType.startsWith("video/") ? (
                  <FileVideo className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
                <span className="text-xs text-base-content/80 max-w-[160px] truncate">
                  {fileName || "Attachment"}
                </span>
              </div>
            )}
            <button
              onClick={removeFile}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-base-300/80 bg-base-100/70 px-2 py-2"
      >
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-xl input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={handleTextChange}
          />
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`btn btn-circle p-0 size-10 sm:size-auto items-center justify-center transition-transform hover:scale-105
                     ${fileData || imagePreview ? "text-emerald-500" : "text-base-content/60"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={16} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle p-0 size-10 sm:size-auto items-center justify-center transition-transform hover:scale-105"
          disabled={(!text.trim() && !fileData && !imagePreview) || isUploading || isSending}
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
