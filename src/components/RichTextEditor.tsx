import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo, Redo, Type,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const MenuButton = ({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded-lg transition-all duration-150 ${
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "premium-input min-h-[200px] max-h-[400px] overflow-y-auto prose prose-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_strong]:text-foreground [&_em]:text-foreground",
        "data-placeholder": placeholder || "Rédigez votre message ici...",
      },
    },
  });

  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (editor && !isInternalUpdate.current && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
    isInternalUpdate.current = false;
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Gras">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italique">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Souligné">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Barré">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Titre">
          <Type className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Aligner à gauche">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centrer">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Aligner à droite">
          <AlignRight className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Liste à puces">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Liste numérotée">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Annuler">
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Rétablir">
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
