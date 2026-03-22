import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Eye, EyeOff, Mail, User, FileText, CheckCircle2, XCircle, Loader2, BookTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "./RichTextEditor";
import TemplateManager from "./TemplateManager";

const EmailComposer = () => {
  const [to, setTo] = useState("");
  const [prenom, setPrenom] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [templateOpen, setTemplateOpen] = useState(false);

  const bodyText = bodyHtml.replace(/<[^>]*>/g, "").trim();
  const isValid = to.includes("@") && to.includes(".") && subject.trim() && bodyText.length > 0;

  const processedHtml = bodyHtml.replace(/\{prenom\}/gi, prenom || "");

  const handleSend = async () => {
    if (!isValid) return;
    setSending(true);
    setStatus("idle");

    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to, prenom, subject, bodyHtml: processedHtml },
      });

      if (error) throw error;

      setStatus("success");
      setTo("");
      setPrenom("");
      setSubject("");
      setBodyHtml("<p></p>");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    } finally {
      setSending(false);
    }
  };

  const handleLoadTemplate = (html: string) => {
    setBodyHtml(html);
  };

  return (
    <>
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
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  VIZION
                </h1>
                <p className="text-muted-foreground text-xs tracking-widest uppercase">
                  Email Sender
                </p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="glass-card p-6 sm:p-8 mb-6"
          >
            <div className="space-y-5">
              {/* To + Prénom row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
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
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Prénom du destinataire"
                    className="premium-input"
                  />
                </div>
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

              {/* Body — Rich text editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Message
                  </label>
                  <button
                    onClick={() => setTemplateOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <BookTemplate className="w-3.5 h-3.5" />
                    Charger un template
                  </button>
                </div>
                <RichTextEditor
                  content={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Rédigez votre message ici..."
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
                <span className="text-sm font-medium">Erreur lors de l'envoi. Réessayez.</span>
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
                <div className="email-preview-card overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-3 space-y-1">
                    <div><span className="font-medium">À :</span> {to || "—"}</div>
                    <div><span className="font-medium">Objet :</span> {subject || "—"}</div>
                  </div>
                  {/* Email preview matching VIZION style */}
                  <div className="bg-secondary/30 rounded-xl p-4 sm:p-6">
                    <div className="bg-card rounded-2xl overflow-hidden border border-border" style={{ boxShadow: "var(--shadow-md)" }}>
                      {/* VIZION Header */}
                      <div className="text-center py-6 px-8">
                        <div className="font-display text-2xl font-extrabold tracking-[4px] text-foreground">
                          VIZION
                        </div>
                      </div>
                      <div className="mx-8">
                        <div className="h-px bg-border" />
                      </div>
                      {/* Greeting */}
                      {prenom && (
                        <div className="px-8 pt-8 pb-2">
                          <p className="text-base font-bold text-foreground">
                            Bonjour {prenom},
                          </p>
                        </div>
                      )}
                      {/* Body */}
                      <div className="px-8 py-4">
                        <div
                          className="text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-bold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          dangerouslySetInnerHTML={{ __html: processedHtml }}
                        />
                      </div>
                      {/* Signature */}
                      <div className="px-8 pb-8">
                        <p className="text-sm text-foreground leading-relaxed">
                          Bien à toi,<br />
                          <strong>L'équipe VIZION</strong>
                        </p>
                      </div>
                      <div className="mx-8">
                        <div className="h-px bg-border" />
                      </div>
                      <div className="text-center py-5 px-8">
                        <p className="text-xs text-muted-foreground">
                          VIZION — Collaboration & Partenariats
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <TemplateManager
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onLoadTemplate={handleLoadTemplate}
      />
    </>
  );
};

export default EmailComposer;
