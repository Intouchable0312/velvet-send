import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Inbox } from "lucide-react";
import EmailComposer from "../components/EmailComposer";
import InboxView from "../components/InboxView";

const Index = () => {
  const [tab, setTab] = useState<"compose" | "inbox">("compose");

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center">
          <button
            onClick={() => setTab("compose")}
            className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
              tab === "compose" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="w-4 h-4" />
            Envoyer
            {tab === "compose" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
          <button
            onClick={() => setTab("inbox")}
            className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
              tab === "inbox" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="w-4 h-4" />
            Boîte de réception
            {tab === "inbox" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === "compose" ? (
        <EmailComposer />
      ) : (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="glass-card overflow-hidden" style={{ minHeight: "60vh" }}>
            <InboxView />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;