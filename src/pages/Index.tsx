import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Inbox, MailCheck } from "lucide-react";
import EmailComposer from "../components/EmailComposer";
import InboxView from "../components/InboxView";
import SentView from "../components/SentView";

export interface ReplyContext {
  to: string;
  toName: string;
  subject: string;
}

const Index = () => {
  const [tab, setTab] = useState<"compose" | "inbox" | "sent">("compose");
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);

  const handleReply = (ctx: ReplyContext) => {
    setReplyTo(ctx);
    setTab("compose");
  };

  const clearReply = () => setReplyTo(null);

  const tabs = [
    { id: "compose" as const, label: "Envoyer", icon: Send },
    { id: "inbox" as const, label: "Boîte de réception", icon: Inbox },
    { id: "sent" as const, label: "Envoyés", icon: MailCheck },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {tab === t.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "compose" ? (
        <EmailComposer replyTo={replyTo} onClearReply={clearReply} />
      ) : tab === "inbox" ? (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="glass-card overflow-hidden" style={{ minHeight: "60vh" }}>
            <InboxView onReply={handleReply} />
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="glass-card overflow-hidden" style={{ minHeight: "60vh" }}>
            <SentView />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
