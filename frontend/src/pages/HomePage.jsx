import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="min-h-[100dvh] bg-base-200">
      <div className="flex items-center justify-center pt-16 sm:pt-20 px-2 sm:px-4 pb-2 sm:pb-4">
        <div className="bg-base-100 shadow-cl w-full max-w-6xl h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-8rem)] sm:rounded-lg">
          <div className="flex h-full overflow-hidden sm:rounded-lg">
            <div className={`${selectedUser ? "hidden lg:flex" : "flex"} h-full w-full lg:w-auto`}>
              <Sidebar />
            </div>

            <div className={`${selectedUser ? "flex" : "hidden lg:flex"} flex-1 h-full`}>
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
