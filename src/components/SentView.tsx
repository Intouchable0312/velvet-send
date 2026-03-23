import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MailCheck, RefreshCw, ChevronLeft, ChevronRight, Send,
  ArrowLeft, Loader2, AlertCircle, User, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmailSummary {
  uid: number;
  from: string;
  subject: string;
  date: string;
  to?: string;
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
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Hier";
    if (now.getFullYear() === d.getFullYear()) return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
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

const SentView = () => {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const fetchEmails = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("read-emails", {
        body: { action: "list", page: p, pageSize: PAGE_SIZE, folder: "sent" },
      });
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

  useEffect(() => { fetchEmails(page); }, [page, fetchEmails]);

  const openEmail = async (uid: number) => {
    setLoadingEmail(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("read-emails", {
        body: { action: "read", uid, folder: "sent" },
      });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setSelectedEmail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de lecture");
    } finally {
      setLoadingEmail(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (selectedEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col h-full"
      >
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
              À : {extractName(selectedEmail.to)} &lt;{extractEmail(selectedEmail.to)}&gt;
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">À : {extractName(selectedEmail.to)}</p>
              <p className="text-xs text-muted-foreground">{extractEmail(selectedEmail.to)}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Clock className="w-3.5 h-3.5" />
              {formatFullDate(selectedEmail.date)}
            </div>
          </div>
        </div>

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
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MailCheck className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Emails envoyés</h2>
          {total > 0 && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{total}</span>
          )}
        </div>
        <button
          onClick={() => fetchEmails(page)}
          disabled={loading}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive text-center">{error}</p>
            <button onClick={() => fetchEmails(page)} className="premium-btn text-sm py-2 px-4 mt-2">Réessayer</button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Send className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Aucun email envoyé</p>
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
                className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-secondary/50"
              >
                <div className="shrink-0">
                  <Send className="w-4 h-4 text-muted-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm truncate text-foreground/80">
                      À : {extractName(email.from)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(email.date)}</span>
                  </div>
                  <p className="text-sm truncate text-muted-foreground">{email.subject}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
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

export default SentView;
