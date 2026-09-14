import type { Message as MessageType } from "@/lib/types";
import { Avatar } from "./avatar";
export function Message({
  message,
  compact = false,
  reactionControls,
}: {
  message: MessageType;
  compact?: boolean;
  reactionControls?: React.ReactNode;
}) {
  return (
    <div className={`message ${compact ? "message-compact" : ""}`}>
      <Avatar person={message.author} small={compact} />
      <div className="message-main">
        <div className="message-meta">
          <span>{message.author.display_name.split(" ")[0]}</span>
          {!compact && (
            <time dateTime={message.created_at}>
              {new Date(message.created_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
              })}
            </time>
          )}
        </div>
        <p>{message.content}</p>
        {reactionControls || (
          <div className="reactions">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <span key={emoji} className="reaction">
                {emoji}
                <span>{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
