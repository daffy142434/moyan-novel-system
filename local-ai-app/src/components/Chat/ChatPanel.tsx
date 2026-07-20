import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useChatStore } from "@/stores/chatStore";

export function ChatPanel() {
  const { activeConversationId, conversations } = useChatStore();
  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex-1 flex min-h-0">
      <ConversationList />
      <div className="flex-1 flex flex-col min-h-0">
        {activeConv && (
          <div className="h-10 px-4 border-b border-theme flex items-center gap-3 flex-shrink-0">
            <h2 className="text-sm font-medium text-main truncate">
              {activeConv.title}
            </h2>
            <span className="text-xs text-tertiary">{activeConv.modelId}</span>
          </div>
        )}
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}
