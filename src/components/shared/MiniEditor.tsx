
import React, { useRef, useEffect, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { 
    BoldIcon, ItalicIcon, UnderlineIcon, ListOrderedIcon, ListUnorderedIcon, 
    ClearFormatIcon, FaceSmileIcon, COMMON_EMOJIS, cn 
} from '../../constants';

export interface MiniEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton: React.FC<{ onClick?: (e: React.MouseEvent) => void; children: React.ReactNode; isActive?: boolean; title?: string; type?: "button" | "submit" | "reset"; onMouseDown?: (e: React.MouseEvent) => void; }> = ({ onClick, children, isActive, title, type = "button", onMouseDown }) => (
  <button
    type={type}
    onClick={onClick}
    onMouseDown={onMouseDown || onClick} // Use onMouseDown to prevent editor from losing focus, fallback to onClick
    title={title}
    className={cn(
      "p-2 rounded-md hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent-blue-neon",
      isActive ? "bg-accent-blue-neon/20 text-accent-blue-neon" : "text-text-muted hover:text-text-strong"
    )}
  >
    {children}
  </button>
);

export const MiniEditor: React.FC<MiniEditorProps> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEffectivelyEmpty = (html: string): boolean => !html || html.replace(/<br\s*\/?>/gi, "").replace(/<p>\s*<\/p>/gi, "").trim() === "";
  const effectivelyEmpty = isEffectivelyEmpty(value);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, valueArg?: string) => {
    document.execCommand(command, false, valueArg);
    editorRef.current?.focus(); // Keep focus on editor
    handleInput(); // Update state
  };

  const insertEmoji = (emoji: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, emoji);
      setIsEmojiPickerOpen(false);
      handleInput();
    }
  };
  
  const editorContentClasses = `min-h-[150px] p-3 border border-border-subtle rounded-b-xl focus:outline-none focus:ring-1 focus:ring-accent-blue-neon focus:border-accent-blue-neon overflow-y-auto text-text-default bg-bg-surface bg-opacity-60 backdrop-blur-sm caret-accent-blue-neon`;

  return (
    <div className="border border-border-subtle rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border-subtle bg-bg-surface rounded-t-xl">
        <ToolbarButton onMouseDown={() => execCommand('bold')} title="Negrito"><BoldIcon className="h-5 w-5" /></ToolbarButton>
        <ToolbarButton onMouseDown={() => execCommand('italic')} title="Itálico"><ItalicIcon className="h-5 w-5" /></ToolbarButton>
        <ToolbarButton onMouseDown={() => execCommand('underline')} title="Sublinhado"><UnderlineIcon className="h-5 w-5" /></ToolbarButton>
        <ToolbarButton onMouseDown={() => execCommand('insertOrderedList')} title="Lista Ordenada"><ListOrderedIcon className="h-5 w-5" /></ToolbarButton>
        <ToolbarButton onMouseDown={() => execCommand('insertUnorderedList')} title="Lista Não Ordenada"><ListUnorderedIcon className="h-5 w-5" /></ToolbarButton>
        
        <PopoverPrimitive.Root open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
            <PopoverPrimitive.Trigger asChild>
                 {/* Use um botão padrão para o Popover Trigger */}
                 <button
                    type="button"
                    title="Inserir Emoji"
                    onClick={() => setIsEmojiPickerOpen(prev => !prev)} // Toggle state on click
                    className={cn(
                        "p-2 rounded-md hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent-blue-neon",
                        isEmojiPickerOpen ? "bg-accent-blue-neon/20 text-accent-blue-neon" : "text-text-muted hover:text-text-strong"
                    )}
                >
                    <FaceSmileIcon className="h-5 w-5" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    sideOffset={5}
                    align="start"
                    className={cn(
                        "z-50 w-72 rounded-xl border border-border-subtle bg-bg-surface shadow-2xl p-2",
                        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                    )}
                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent editor focus loss
                    onCloseAutoFocus={(e) => e.preventDefault()} // Prevent editor focus loss
                >
                    <div className="grid grid-cols-8 gap-1 max-h-60 overflow-y-auto">
                        {COMMON_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => insertEmoji(emoji)}
                                className="p-1.5 text-xl rounded-md hover:bg-white/10 transition-colors duration-150"
                                title={`Inserir ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
        <ToolbarButton onMouseDown={() => execCommand('removeFormat')} title="Limpar Formatação"><ClearFormatIcon className="h-5 w-5" /></ToolbarButton>
      </div>
      <div 
        ref={editorRef} 
        contentEditable={true} 
        onInput={handleInput} 
        className={`${editorContentClasses} prose prose-sm sm:prose-base max-w-none prose-invert prose-headings:text-text-strong prose-p:text-text-default prose-strong:text-text-strong prose-a:text-accent-blue-neon prose-li:text-text-default ${effectivelyEmpty ? 'is-empty-placeholder' : ''}`} 
        data-placeholder={placeholder} 
        style={{ whiteSpace: 'pre-wrap' }} 
      />
    </div>
  );
};
