const MessageSkeleton = () => {
  const skeletonMessages = [
    { side: "start", bubble: "w-[60vw] sm:w-[15rem]", line: "w-16" },
    { side: "end", bubble: "w-[46vw] sm:w-[12rem]", line: "w-12" },
    { side: "start", bubble: "w-[52vw] sm:w-[13rem]", line: "w-14" },
    { side: "end", bubble: "w-[66vw] sm:w-[16rem]", line: "w-20" },
    { side: "start", bubble: "w-[44vw] sm:w-[11rem]", line: "w-10" },
    { side: "end", bubble: "w-[58vw] sm:w-[14rem]", line: "w-16" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
      {skeletonMessages.map((message, idx) => (
        <div key={idx} className={`chat ${message.side === "start" ? "chat-start" : "chat-end"}`}>
          <div className="chat-image avatar">
            <div className="size-8 sm:size-10 rounded-full">
              <div
                className="skeleton w-full h-full rounded-full"
                style={{ animationDelay: `${idx * 80}ms` }}
              />
            </div>
          </div>

          <div className="chat-bubble message-skeleton-shell">
            <div
              className={`skeleton h-14 sm:h-16 rounded-2xl ${message.bubble}`}
              style={{ animationDelay: `${idx * 80 + 40}ms` }}
            />
            <div className="mt-1 flex justify-end">
              <div
                className={`skeleton h-3 rounded-md ${message.line}`}
                style={{ animationDelay: `${idx * 80 + 80}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageSkeleton;
