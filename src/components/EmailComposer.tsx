import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Eye, EyeOff, Mail, User, FileText, Pen, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const EmailComposer = () => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("Cordialement,\nL'équipe");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const isValid = to.includes("@") && to.includes(".") && subject.trim() && body.trim();

  const handleSend = async () => {
    if (!isValid) return;
    setSending(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, signature }),
      });

      if (res.ok) {
        setStatus("success");
        setTo("");
        setSubject("");
        setBody("");
        setTimeout(() => setStatus("idle"), 4000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    } finally {
      setSending(false);
    }
  };

  const emailHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="color: #1a1a2e; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${body}</div>
        ${signature ? `<div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${signature}</div>` : ""}
      </div>
    </div>
  `;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="min-h-screen flex items-start justify-center p-4 sm:p-6 lg:p-8 pt-8 sm:pt-12"
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Composer un email
            </h1>
          </div>
          <p className="text-muted-foreground text-sm ml-[52px]">
            Envoyez un email professionnel en quelques clics
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="glass-card p-6 sm:p-8 mb-6"
        >
          <div className="space-y-5">
            {/* To */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Destinataire
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="adresse@exemple.com"
                className="premium-input"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Objet
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet de votre email"
                className="premium-input"
              />
            </div>

            {/* Body */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Rédigez votre message ici..."
                rows={6}
                className="premium-input resize-none"
              />
            </div>

            {/* Signature */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Pen className="w-4 h-4 text-muted-foreground" />
                Signature
              </label>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Votre signature..."
                rows={2}
                className="premium-input resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-foreground font-medium text-sm transition-all duration-200 hover:bg-secondary"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? "Masquer l'aperçu" : "Aperçu"}
            </button>
            <button
              onClick={handleSend}
              disabled={!isValid || sending}
              className="premium-btn flex-1 sm:flex-none text-sm"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spinner" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer l'email
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Status messages */}
        <AnimatePresence>
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20 text-success"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Email envoyé avec succès !</span>
            </motion.div>
          )}
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive"
            >
              <XCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Erreur lors de l'envoi. Vérifiez la configuration du backend Flask.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                  Aperçu de l'email
                </h2>
                <p className="text-muted-foreground text-xs">
                  Rendu tel que le destinataire le verra
                </p>
              </div>
              <div className="email-preview-card">
                <div className="text-xs text-muted-foreground mb-3 space-y-1">
                  <div><span className="font-medium">À :</span> {to || "—"}</div>
                  <div><span className="font-medium">Objet :</span> {subject || "—"}</div>
                </div>
                <div
                  className="bg-card rounded-xl p-6 border border-border"
                  style={{ boxShadow: "var(--shadow-sm)" }}
                >
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {body || <span className="text-muted-foreground italic">Votre message apparaîtra ici…</span>}
                  </div>
                  {signature && (
                    <div className="mt-6 pt-4 border-t border-border text-sm text-muted-foreground whitespace-pre-wrap">
                      {signature}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default EmailComposer;
