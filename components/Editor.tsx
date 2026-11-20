'use client';

import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { useMemo, useRef } from 'react';
import { Table, Plus, Trash2 } from 'lucide-react';

// Require dynamic import because Quill accesses the document object
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-64 w-full flex items-center justify-center text-gray-400 bg-surface-white dark:bg-gray-900 border border-border-subtle dark:border-gray-700 rounded-xl">Loading editor...</div>
});

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    showTable?: boolean;
    readOnly?: boolean;
}

export default function Editor({ value, onChange, placeholder, className = '', showTable = true, readOnly = false }: EditorProps) {
    const quillRef = useRef<any>(null);

    // Basic toolbar configuration
    const modules = useMemo(() => ({
        table: true, // Enable Quill 2.0 native table module
        tableUI: true, // Enable native Quill 2 table resize/UI
        keyboard: {
            bindings: {
                tableEnter: {
                    key: 'Enter',
                    format: ['table', 'table-cell'], // Only trigger if cursor is inside a table
                    handler: function(this: any, range: any, context: any) {
                        this.quill.insertText(range.index, '\n');
                        setTimeout(() => this.quill.setSelection(range.index + 1), 0);
                        return false; 
                    }
                }
            }
        },
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean']
        ],
        clipboard: {
            // toggle to add extra line breaks when pasting HTML:
            matchVisual: false,
        }
    }), []);

    const getTable = () => quillRef.current?.getEditor()?.getModule('table');

    return (
        <div className={`editor-container flex flex-col relative ${className}`}>
            {/* Custom Table Tool Bar */}
            {showTable && !readOnly && (
                <div className="absolute top-0 -right-6 z-20 flex items-center gap-0 p-1 bg-surface-white dark:bg-gray-800 border border-border-subtle/50 dark:border-gray-700/80 rounded shadow-sm transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mx-1.5 hidden sm:inline-block">Table:</span>
                    <button
                        onClick={() => getTable()?.insertTable(2, 2)}
                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-background-light dark:hover:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 transition-colors"
                    >
                        <Table className="w-3.5 h-3.5" /> <span>Insert</span>
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-gray-700 mx-1"></div>
                    <button
                        onClick={() => getTable()?.insertRowBelow()}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-background-light dark:hover:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 transition-colors"
                        title="Add Row Below"
                    >
                        <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline-block">+ Row</span>
                    </button>
                    <button
                        onClick={() => getTable()?.insertColumnRight()}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-background-light dark:hover:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 transition-colors"
                        title="Add Column Right"
                    >
                        <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline-block">+ Col</span>
                    </button>
                    <div className="w-px h-4 bg-border-subtle dark:bg-gray-600 mx-1"></div>
                    <button
                        onClick={() => getTable()?.deleteRow()}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded text-xs transition-colors"
                        title="Delete Row"
                    >
                        <Trash2 className="w-3 h-3" /> <span className="hidden sm:inline-block">Row</span>
                    </button>
                    <button
                        onClick={() => getTable()?.deleteColumn()}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded text-xs transition-colors"
                        title="Delete Column"
                    >
                        <Trash2 className="w-3 h-3" /> <span className="hidden sm:inline-block">Col</span>
                    </button>
                    <button
                        onClick={() => getTable()?.deleteTable()}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 hover:text-red-700 dark:text-red-400 rounded text-xs transition-colors ml-auto font-medium"
                        title="Delete Entire Table"
                    >
                        <Trash2 className="w-3 h-3" /> <span className="hidden sm:inline-block">Table</span>
                    </button>
                </div>
            )}

            <ReactQuill
                // @ts-ignore - react-quill-new types don't officially support ref on the dynamic wrapper but it works at runtime
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                placeholder={placeholder}
                readOnly={readOnly}
                className="quill-editor"
            />
            {/* Inject custom styles for Quill in Dark Mode directly */}
            <style jsx global>{`
                .editor-container .quill-editor {
                    display: flex;
                    flex-direction: column;
                    height: auto;
                }
                .editor-container .ql-toolbar {
                    border: none !important;
                    border-bottom: 1px solid #C0CFDB !important; /* border-subtle */
                    background-color: transparent !important;
                    padding-left: 0 !important;
                    padding-right: ${showTable ? '390px' : '0'} !important;
                    width: ${showTable ? 'calc(100% + 32px)' : '100%'} !important;
                    margin-right: ${showTable ? '-32px' : '0'} !important; 
                    display: flex !important;
                    flex-wrap: wrap !important;
                    align-items: center;
                    position: sticky;
                    top: 0; 
                    z-index: 10;
                    backdrop-filter: blur(8px);
                }
                .editor-container .ql-toolbar .ql-formats {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: nowrap !important;
                    align-items: center;
                    margin-right: 8px;
                }
                /* Toolbar icon colors for light mode to match our theme */
                .editor-container .ql-toolbar button {
                    color: #4b5563 !important; /* gray-600 */
                }
                .editor-container .ql-stroke {
                    stroke: #4b5563 !important; /* gray-600 */
                }
                .editor-container .ql-fill {
                    fill: #4b5563 !important; /* gray-600 */
                }
                .editor-container .ql-picker-label {
                    color: #4b5563 !important; /* gray-600 */
                }
                .editor-container .ql-container {
                    border: none !important;
                    display: flex;
                    flex-direction: column;
                    min-height: 200px;
                    overflow: visible !important;
                }
                .editor-container .ql-editor {
                    font-size: 0.875rem;
                    line-height: 1.625;
                    padding: 1rem 0 3rem 0; /* extra padding at bottom so content doesn't hit edge */
                    color: #1F2937; /* text-main for light mode */
                    overflow-y: visible !important;
                    height: auto !important;
                }

                /* Dark mode styling overrides for Quill - applies when .dark is present on ancestor */
                .dark .editor-container .ql-toolbar {
                    border-bottom-color: #374151 !important; /* gray-700 */
                }
                .dark .editor-container .ql-editor {
                    color: #f3f4f6 !important; /* gray-100 */
                }
                .dark .editor-container .ql-editor.ql-blank::before {
                    color: #9ca3af !important; /* gray-400 */
                }
                .dark .editor-container .ql-container {
                    background-color: transparent !important;
                }
                .dark .editor-container .ql-stroke {
                    stroke: #d1d5db !important; /* gray-300 */
                }
                .dark .editor-container .ql-fill {
                    fill: #d1d5db !important; /* gray-300 */
                }
                .dark .editor-container .ql-picker-label {
                    color: #d1d5db !important; /* gray-300 */
                }
                .dark .editor-container .ql-picker-options {
                    background-color: #111827 !important; /* gray-900 */
                    border-color: #374151 !important; /* gray-700 */
                }
                .dark .editor-container .ql-snow .ql-picker.ql-expanded .ql-picker-label {
                    color: #3E88B0 !important; /* primary */
                }
                
                /* Quill Toolbar Dropdown Overrides */
                .editor-container .ql-snow .ql-picker-options {
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    padding: 0.5rem 0;
                }
                /* Fix table rendering styles to make them look nice */
                .editor-container .ql-editor table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1rem 0;
                    table-layout: auto;
                }
                .editor-container .ql-editor td {
                    border: 1px solid #C0CFDB; /* bg-border-subtle */
                    padding: 0.5rem 0.75rem;
                    min-width: 50px;
                    /* Fallback for resizable columns using native CSS resize */
                    resize: horizontal;
                    overflow: auto;
                    position: relative;
                }
                .dark .editor-container .ql-editor td {
                    border-color: #374151; /* gray-700 */
                }
            `}</style>
        </div>
    );
}
