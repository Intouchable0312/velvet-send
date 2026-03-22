import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Trash2, X, Save } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

export interface EmailTemplate {
  id: string;
  name: string;
  html: string;
  createdAt: number;
}

const STORAGE_KEY = "vizion-email-templates";

export function loadTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: EmailTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
  onLoadTemplate: (html: string) => void;
}

const TemplateManager = ({ open, onClose, onLoadTemplate }: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(loadTemplates);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHtml, setNewHtml] = useState("<p></p>");

  const handleSave = () => {
    if (!newName.trim()) return;
    const template: EmailTemplate = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      html: newHtml,
      createdAt: Date.now(),
    };
    const updated = [template, ...templates];
    setTemplates(updated);
    saveTemplates(updated);
    setCreating(false);
    setNewName("");
    setNewHtml("<p></p>");
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const handleLoad = (template: EmailTemplate) => {
    onLoadTemplate(template.html);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Templates</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Créez et gérez vos modèles d'email
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!creating && (
                <button
                  onClick={() => setCreating(true)}
                  className="premium-btn text-sm py-2 px-4"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Create new template */}
            <AnimatePresence>
              {creating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nom du template..."
                      className="premium-input"
                      autoFocus
                    />
                    <RichTextEditor
                      content={newHtml}
                      onChange={setNewHtml}
                      placeholder="Rédigez votre template ici... Utilisez {prenom} pour insérer le prénom dynamiquement."
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={!newName.trim()} className="premium-btn text-sm py-2 px-4">
                        <Save className="w-4 h-4" />
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setCreating(false); setNewName(""); setNewHtml("<p></p>"); }}
                        className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Astuce : utilisez <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-xs">{"{prenom}"}</code> dans votre texte pour qu'il soit remplacé automatiquement par le prénom du destinataire.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Templates list */}
            {templates.length === 0 && !creating ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Aucun template pour l'instant</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Créez votre premier modèle d'email</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="group p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all duration-200 cursor-pointer"
                    style={{ boxShadow: "var(--shadow-sm)" }}
                    onClick={() => handleLoad(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-foreground text-sm truncate">
                          {template.name}
                        </h3>
                        <p className="text-muted-foreground text-xs mt-1">
                          {new Date(template.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <div
                          className="text-xs text-muted-foreground mt-2 line-clamp-2 [&_strong]:font-semibold [&_em]:italic"
                          dangerouslySetInnerHTML={{ __html: template.html }}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                        className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TemplateManager;
