
import React, { useRef, useEffect } from 'react';
import { 
    BoldIcon, ItalicIcon, UnderlineIcon, ListOrderedIcon, ListUnorderedIcon,
    ParagraphIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, AlignJustifyIcon, ClearFormatIcon
} from '../../constants.tsx'; 

export interface MiniEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const MiniEditor: React.FC<MiniEditorProps> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEffectivelyEmpty = (html: string): boolean => !html || html.replace(/<br\s*\/?>/gi, "").replace(/<p>\s*<\/p>/gi, "").trim() === "";
  const effectivelyEmpty = isEffectivelyEmpty(value);

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

  const execCmd = (command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
    if (editorRef.current) { 
        editorRef.current.focus(); 
        onChange(editorRef.current.innerHTML); // Trigger onChange after command execution
    }
  };
  
  const editorToolbarClasses = "flex items-center flex-wrap gap-1 p-2 bg-neutral-700 border border-neutral-600 rounded-t-md";
  const editorButtonClasses = "p-1.5 hover:bg-neutral-600 rounded text-neutral-300 hover:text-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed";
  const editorContentClasses = `min-h-[150px] p-3 border border-t-0 border-neutral-600 rounded-b-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary overflow-y-auto text-neutral-100 bg-neutral-800`;
  const toolbarGroupSeparatorClasses = "h-5 w-px bg-neutral-600 mx-1";

  return (
    <div>
      <div className={editorToolbarClasses}>
        {/* Group 1: Basic Styles */}
        <button type="button" onClick={() => execCmd('bold')} title="Negrito" className={editorButtonClasses}><BoldIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('italic')} title="Itálico" className={editorButtonClasses}><ItalicIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('underline')} title="Sublinhado" className={editorButtonClasses}><UnderlineIcon className="h-5 w-5" /></button>
        
        <div className={toolbarGroupSeparatorClasses}></div>

        {/* Group 2: Headings */}
        <button type="button" onClick={() => execCmd('formatBlock', 'H2')} title="Título 2" className={editorButtonClasses}>H2</button>
        <button type="button" onClick={() => execCmd('formatBlock', 'H3')} title="Título 3" className={editorButtonClasses}>H3</button>
        <button type="button" onClick={() => execCmd('formatBlock', 'H4')} title="Título 4" className={editorButtonClasses}>H4</button>
        <button type="button" onClick={() => execCmd('formatBlock', 'P')} title="Parágrafo" className={editorButtonClasses}><ParagraphIcon className="h-5 w-5" /></button>

        <div className={toolbarGroupSeparatorClasses}></div>

        {/* Group 3: Lists */}
        <button type="button" onClick={() => execCmd('insertOrderedList')} title="Lista Ordenada" className={editorButtonClasses}><ListOrderedIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('insertUnorderedList')} title="Lista Não Ordenada" className={editorButtonClasses}><ListUnorderedIcon className="h-5 w-5" /></button>
        
        <div className={toolbarGroupSeparatorClasses}></div>

        {/* Group 4: Alignment */}
        <button type="button" onClick={() => execCmd('justifyLeft')} title="Alinhar à Esquerda" className={editorButtonClasses}><AlignLeftIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('justifyCenter')} title="Alinhar ao Centro" className={editorButtonClasses}><AlignCenterIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('justifyRight')} title="Alinhar à Direita" className={editorButtonClasses}><AlignRightIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => execCmd('justifyFull')} title="Justificar" className={editorButtonClasses}><AlignJustifyIcon className="h-5 w-5" /></button>

        <div className={toolbarGroupSeparatorClasses}></div>
        
        {/* Group 5: Clear Format (Link buttons removed) */}
        <button type="button" onClick={() => execCmd('removeFormat')} title="Limpar Formatação" className={editorButtonClasses}><ClearFormatIcon className="h-5 w-5" /></button>
      </div>
      <div 
        ref={editorRef} 
        contentEditable={true} 
        onInput={handleInput} 
        className={`${editorContentClasses} ${effectivelyEmpty ? 'is-empty-placeholder' : ''}`} 
        data-placeholder={placeholder} 
        style={{ whiteSpace: 'pre-wrap' }} 
      />
    </div>
  );
};