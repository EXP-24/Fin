"""Fix Finsight document tray layout without changing backend or Sidebar.

Uses the existing DocumentPanel_Finsight_v4.jsx as the starting point.
From PowerShell at F:\\Projects\\Finsight:
  .\\.venv\\Scripts\\python.exe .\\fix_finsight_layout_v5.py

Actions:
  * Move document manager into normal page flow, above chat messages.
  * Remove duplicate 'Add file' button (paperclip remains the only upload control).
  * Add 'Documents (N)' navigation button by the paperclip to access the manager.
  * Back up all 3 files before any changes; abort on unexpected content.
"""
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'frontend' / 'src'
DOC = SRC / 'components' / 'DocumentPanel.jsx'
CHAT = SRC / 'components' / 'ChatPanel.jsx'
PAGE = SRC / 'pages' / 'SessionPage.jsx'
TAG = 'finsight-document-manager'
BACKUP_SUFFIX = '.before-layout-v5.bak'


def replace_once(text: str, old: str, new: str, name: str) -> str:
    n = text.count(old)
    if n != 1:
        raise ValueError(f'{name}: expected 1 occurrence, found {n}. No files changed.')
    return text.replace(old, new, 1)


def patch_document_panel(text: str) -> str:
    text = replace_once(
        text,
        '''    <div className="fixed left-sidebar-width right-0 bottom-[145px] z-40 pointer-events-none">
      <div className="mx-auto w-full max-w-chat-max-width px-margin-desktop pointer-events-none">
        <section className="pointer-events-auto rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-xl overflow-hidden">''',
        '''    <div id="finsight-document-manager" className="relative w-full scroll-mt-24">
      <div className="w-full">
        <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm overflow-hidden">''',
        'DocumentPanel.jsx positioning',
    )
    text = replace_once(
        text,
        '''            <button
              type="button"
              onClick={() => inputRef?.current?.click()}
              disabled={uploading}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary text-on-primary px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[17px]">add</span>
              {vi ? "Thêm tệp" : "Add file"}
            </button>''',
        '''            <span className="text-[11px] text-on-surface-variant text-right">
              {vi ? "Tải lên bằng biểu tượng kẹp giấy trong ô chat" : "Use the paperclip in chat to upload"}
            </span>''',
        'DocumentPanel.jsx Add file button',
    )
    return text


def patch_chat(text: str) -> str:
    text = replace_once(
        text,
        'export default function ChatPanel({ sessionId, ready, initialPrompt, onUploadClick }) {',
        'export default function ChatPanel({ sessionId, ready, initialPrompt, onUploadClick, documentCount = 0 }) {',
        'ChatPanel.jsx props',
    )
    text = replace_once(
        text,
        '''                  <span className="material-symbols-outlined">attach_file</span>
                </button>''',
        '''                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <button
                  type="button"
                  title="Xem các tài liệu đã tải lên"
                  aria-label={`Xem ${documentCount} tài liệu trong hội thoại`}
                  onClick={() => document.getElementById("finsight-document-manager")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  <span>{documentCount}</span>
                </button>''',
        'ChatPanel.jsx paperclip',
    )
    return text


def patch_session_page(text: str) -> str:
    # Match multiline, self-closing JSX components. Do not depend on any exact
    # JSX props or on the body of the arrow-function attributes.
    chat_rx = r'(?P<chat>^[ \t]*<ChatPanel\s*\n(?:(?!^[ \t]*/>)[\s\S])*?^[ \t]*/>)'
    docs_rx = r'(?P<docs>^[ \t]*<DocumentPanel\s*\n(?:(?!^[ \t]*/>)[\s\S])*?^[ \t]*/>)'
    pattern = re.compile(chat_rx + r'\s*' + docs_rx, re.M)
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError(f'SessionPage.jsx: expected adjacent ChatPanel followed by DocumentPanel, found {len(matches)}. No files changed.')
    match = matches[0]
    chat = match.group('chat')
    docs = match.group('docs')
    chat = replace_once(chat,
                        '          onUploadClick={() => uploadInputRef.current?.click()}',
                        '          onUploadClick={() => uploadInputRef.current?.click()}\n          documentCount={documents.length}',
                        'SessionPage.jsx ChatPanel props')
    return text[:match.start()] + docs + '\n' + chat + text[match.end():]


def main() -> None:
    paths = [DOC, CHAT, PAGE]
    for p in paths:
        if not p.is_file():
            raise FileNotFoundError(f'Missing: {p}. Save the script to F:\\Projects\\Finsight')
    originals = {p: p.read_text(encoding='utf-8') for p in paths}
    if TAG in originals[DOC]:
        print('DocumentPanel already contains the v5 manager ID. No changes made.')
        return
    patched = {
        DOC: patch_document_panel(originals[DOC]),
        CHAT: patch_chat(originals[CHAT]),
        PAGE: patch_session_page(originals[PAGE]),
    }
    backups = {p: p.with_name(p.name + BACKUP_SUFFIX) for p in paths}
    if any(b.exists() for b in backups.values()):
        raise FileExistsError('A v5 backup already exists; no changes made. Check the *.before-layout-v5.bak files.')
    # Back up all originals before writing any source file.
    for p, b in backups.items():
        b.write_text(originals[p], encoding='utf-8')
    try:
        for p, new_text in patched.items():
            p.write_text(new_text, encoding='utf-8')
            print(f'OK: {p.relative_to(ROOT)}')
    except Exception:
        for p, orig_text in originals.items():
            p.write_text(orig_text, encoding='utf-8')
        raise
    print('\nDone. Only one upload button (paperclip) remains.')
    print('Document manager is now above chat messages, in normal page flow.')
    print('The new folder/count button next to the paperclip jumps to the document list.')
    print('Verify: cd frontend ; npm run build')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        sys.exit(1)
