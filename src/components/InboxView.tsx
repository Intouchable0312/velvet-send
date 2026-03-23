import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, RefreshCw, ChevronLeft, ChevronRight, Mail, MailOpen,
  ArrowLeft, Reply, Loader2, AlertCircle, Send, User, Clock,
  Search, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "./RichTextEditor";
import TemplateManager from "./TemplateManager";

interface EmailSummary {
  uid: number;
  from: string;
  subject: string;
  date: string;
  read: boolean;
}

interface EmailDetail {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  body: string;
  isHtml: boolean;
}

const PAGE_SIZE = 15;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (isYesterday) return "Hier";
    if (now.getFullYear() === d.getFullYear()) {
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function extractName(from: string): string {
  if (!from) return "Inconnu";
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<[^>]+>/, "").trim() || "Inconnu";
}

function extractEmail(from: string): string {
  if (!from) return "";
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

const InboxView = () => {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  // Reply state
  const [replying, setReplying] = useState(false);
  const [replyHtml, setReplyHtml] = useState("<p></p>");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyStatus, setReplyStatus] = useState<"idle" | "success" | "error">("idle");
  const [templateOpen, setTemplateOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const fetchEmails = useCallback(async (p: number, search?: string) => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { action: "list", page: p, pageSize: PAGE_SIZE };
      if (search) body.search = search;
      const { data, error: fnError } = await supabase.functions.invoke("read-emails", { body });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setEmails(data.emails || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(page, activeSearch); }, [page, activeSearch, fetchEmails]);

  const handleSearch = () => {
    setPage(1);
    setActiveSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setPage(1);
  };

  const openEmail = async (uid: number) => {
    setLoadingEmail(true);
    setReplying(false);
    setReplyHtml("<p></p>");
    setReplyStatus("idle");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("read-emails", {
        body: { action: "read", uid },
      });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setSelectedEmail(data);
      setEmails((prev) => prev.map((e) => (e.uid === uid ? { ...e, read: true } : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de lecture");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleReply = async () => {
    if (!selectedEmail) return;
    const plainText = replyHtml.replace(/<[^>]*>/g, "").trim();
    if (!plainText) return;

    setSendingReply(true);
    setReplyStatus("idle");
    try {
      const { error: fnError } = await supabase.functions.invoke("send-email", {
        body: {
          to: extractEmail(selectedEmail.from),
          prenom: extractName(selectedEmail.from),
          subject: `Re: ${selectedEmail.subject.replace(/^Re:\s*/i, "")}`,
          bodyHtml: replyHtml,
        },
      });
      if (fnError) throw fnError;
      setReplyStatus("success");
      setReplyHtml("<p></p>");
      setTimeout(() => { setReplying(false); setReplyStatus("idle"); }, 2000);
    } catch {
      setReplyStatus("error");
      setTimeout(() => setReplyStatus("idle"), 3000);
    } finally {
      setSendingReply(false);
    }
  };

  const handleLoadTemplate = (html: string) => {
    setReplyHtml(html);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const unreadCount = emails.filter((e) => !e.read).length;

  // ── Email detail view ──
  if (selectedEmail) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <button
              onClick={() => setSelectedEmail(null)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-foreground text-sm sm:text-base truncate">
                {selectedEmail.subject}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {extractName(selectedEmail.from)} &lt;{extractEmail(selectedEmail.from)}&gt;
              </p>
            </div>
            <button
              onClick={() => setReplying(!replying)}
              className="premium-btn text-sm py-2 px-4"
            >
              <Reply className="w-4 h-4" />
              <span className="hidden sm:inline">Répondre</span>
            </button>
          </div>

          {/* Email meta */}
          <div className="px-6 py-4 border-b border-border bg-secondary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{extractName(selectedEmail.from)}</p>
                <p className="text-xs text-muted-foreground">{extractEmail(selectedEmail.from)}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3.5 h-3.5" />
                {formatFullDate(selectedEmail.date)}
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loadingEmail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : selectedEmail.isHtml ? (
              <div
                className="prose prose-sm max-w-none [&_img]:max-w-full [&_table]:w-full text-foreground"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {selectedEmail.body}
              </pre>
            )}
          </div>

          {/* Reply panel — full rich editor */}
          <AnimatePresence>
            {replying && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">Répondre à {extractName(selectedEmail.from)}</p>
                    <button
                      onClick={() => setTemplateOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Charger un template
                    </button>
                  </div>
                  <RichTextEditor
                    content={replyHtml}
                    onChange={setReplyHtml}
                    placeholder="Rédigez votre réponse..."
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleReply}
                      disabled={!replyHtml.replace(/<[^>]*>/g, "").trim() || sendingReply}
                      className="premium-btn text-sm py-2 px-5"
                    >
                      {sendingReply ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                      ) : (
                        <><Send className="w-4 h-4" /> Envoyer</>
                      )}
                    </button>
                    <button
                      onClick={() => setReplying(false)}
                      className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      Annuler
                    </button>
                    {replyStatus === "success" && (
                      <span className="text-sm text-green-600 font-medium">✓ Réponse envoyée</span>
                    )}
                    {replyStatus === "error" && (
                      <span className="text-sm text-destructive font-medium">Erreur d'envoi</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <TemplateManager
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          onLoadTemplate={handleLoadTemplate}
        />
      </>
    );
  }

  // ── Email list view ──
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Boîte de réception</h2>
          {total > 0 && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
              {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchEmails(page, activeSearch)}
          disabled={loading}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher par expéditeur, objet ou contenu…"
              className="premium-input pl-9 pr-9 py-2 text-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={handleSearch} className="premium-btn text-sm py-2 px-4">
            <Search className="w-4 h-4" />
          </button>
        </div>
        {activeSearch && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              Résultats pour « {activeSearch} » — {total} trouvé{total > 1 ? "s" : ""}
            </span>
            <button onClick={clearSearch} className="text-xs text-primary hover:underline">
              Effacer
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement des emails…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive text-center">{error}</p>
            <button onClick={() => fetchEmails(page, activeSearch)} className="premium-btn text-sm py-2 px-4 mt-2">
              Réessayer
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Inbox className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeSearch ? "Aucun résultat" : "Aucun email"}
            </p>
          </div>
        ) : (
          <div>
            {emails.map((email, index) => (
              <motion.div
                key={email.uid}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => openEmail(email.uid)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-secondary/50 ${
                  !email.read ? "bg-primary/5" : ""
                }`}
              >
                {/* Unread indicator */}
                <div className="shrink-0 relative">
                  {email.read ? (
                    <MailOpen className="w-4 h-4 text-muted-foreground/40" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-primary" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm truncate ${!email.read ? "font-bold text-foreground" : "text-foreground/80"}`}>
                      {extractName(email.from)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(email.date)}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${!email.read ? "font-semibold text-foreground/90" : "text-muted-foreground"}`}>
                    {email.subject}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default InboxView;