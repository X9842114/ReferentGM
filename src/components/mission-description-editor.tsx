"use client";

import { cn } from "@/lib/utils";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const COLORS = [
  "#ffffff",
  "#a78bfa",
  "#818cf8",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#f472b6",
];

type MissionDescriptionEditorProps = {
  value: string;
  onChange: (html: string, plain: string) => void;
  placeholder?: string;
  className?: string;
  toolbarExtra?: ReactNode;
};

export function MissionDescriptionEditor({
  value,
  onChange,
  placeholder = "Écris la description de la mission…",
  className,
  toolbarExtra,
}: MissionDescriptionEditorProps) {
  const [showColors, setShowColors] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "mission-link" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "mission-tiptap min-h-[180px] max-h-[320px] overflow-y-auto px-4 py-3 text-sm text-white/90 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML(), ed.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current && editor.isEmpty) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Lien URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.08] bg-black/20",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-2 py-2">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barré"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Sep />

        <div className="relative">
          <ToolbarButton
            active={showColors}
            onClick={() => setShowColors((v) => !v)}
            title="Couleur du texte"
          >
            <Palette className="h-3.5 w-3.5" />
          </ToolbarButton>
          {showColors ? (
            <div className="absolute top-full left-0 z-20 mt-2 flex gap-1.5 rounded-xl border border-white/10 bg-black/95 p-2 shadow-xl backdrop-blur-xl">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  className="h-5 w-5 rounded-full border border-white/20 transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setShowColors(false);
                  }}
                />
              ))}
              <button
                type="button"
                className="rounded-md px-1.5 text-[10px] text-white/50 hover:text-white"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColors(false);
                }}
              >
                Reset
              </button>
            </div>
          ) : null}
        </div>

        <ToolbarButton
          active={editor.isActive("highlight")}
          onClick={() =>
            editor.chain().focus().toggleHighlight({ color: "#a78bfa55" }).run()
          }
          title="Surlignage"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={setLink}
          title="Lien"
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {toolbarExtra ? (
          <>
            <Sep />
            <div className="ml-auto flex items-center">{toolbarExtra}</div>
          </>
        ) : null}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-white/45 hover:bg-white/[0.07] hover:text-white/90"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-white/10" />;
}
