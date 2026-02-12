import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const Dashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ask-ai');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const userEmail = localStorage.getItem('user_email') || 'user@example.com';
    const userName = userEmail.split('@')[0];

    // Per-user storage keys
    const chatKey = `chat_${userEmail}`;
    const sessionsKey = `sessions_${userEmail}`;
    const foldersKey = `folders_${userEmail}`;

    // State
    const [question, setQuestion] = useState('');
    const [chatHistory, setChatHistory] = useState(() => {
        const saved = localStorage.getItem(chatKey);
        return saved ? JSON.parse(saved) : [];
    });
    const [chatSessions, setChatSessions] = useState(() => {
        const saved = localStorage.getItem(sessionsKey);
        return saved ? JSON.parse(saved) : [];
    });
    const [folders, setFolders] = useState(() => {
        const saved = localStorage.getItem(foldersKey);
        return saved ? JSON.parse(saved) : [{ id: 'default', name: 'General' }];
    });
    const [aiLoading, setAiLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingMsgIndex, setEditingMsgIndex] = useState(null);
    const [editText, setEditText] = useState('');
    const [renamingId, setRenamingId] = useState(null);
    const [renameText, setRenameText] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [collapsedFolders, setCollapsedFolders] = useState({});
    const [attachedFile, setAttachedFile] = useState(null);
    const [attachedPreview, setAttachedPreview] = useState(null);
    const chatEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auth check
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) navigate('/login');
    }, [navigate]);

    // Persist chat & sessions
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        localStorage.setItem(chatKey, JSON.stringify(chatHistory));
    }, [chatHistory, chatKey]);

    useEffect(() => {
        localStorage.setItem(sessionsKey, JSON.stringify(chatSessions));
    }, [chatSessions, sessionsKey]);

    useEffect(() => {
        localStorage.setItem(foldersKey, JSON.stringify(folders));
    }, [folders, foldersKey]);

    // Speech Recognition
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            const r = new SR();
            r.continuous = false; r.interimResults = false; r.lang = 'en-US';
            r.onresult = (e) => { setQuestion(p => p ? p + ' ' + e.results[0][0].transcript : e.results[0][0].transcript); setIsListening(false); };
            r.onerror = () => setIsListening(false);
            r.onend = () => setIsListening(false);
            recognitionRef.current = r;
        }
    }, []);

    const toggleVoice = () => {
        if (!recognitionRef.current) { alert('Speech recognition not supported.'); return; }
        if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
        else { recognitionRef.current.start(); setIsListening(true); }
    };

    // TTS
    const speakText = (text) => {
        if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1; u.pitch = 1;
        window.speechSynthesis.speak(u);
    };

    // Copy
    const copyText = (text) => {
        navigator.clipboard.writeText(text);
    };

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_email');
        navigate('/login');
    };

    // File upload
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAttachedFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => setAttachedPreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setAttachedPreview(null);
        }
    };

    const clearAttachment = () => { setAttachedFile(null); setAttachedPreview(null); };

    // Ask AI
    const handleAsk = async (e) => {
        e.preventDefault();
        if ((!question.trim() && !attachedFile) || aiLoading) return;
        let content = question;
        let attachment = null;
        if (attachedFile) {
            attachment = { name: attachedFile.name, type: attachedFile.type, preview: attachedPreview };
            if (!content.trim()) content = `[Attached: ${attachedFile.name}]`;
        }
        const userMessage = { role: 'user', content, attachment, reactions: {} };
        setChatHistory(prev => [...prev, userMessage]);
        setQuestion('');
        clearAttachment();
        setAiLoading(true);

        try {
            const res = await fetch('http://127.0.0.1:8000/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content, system_prompt: "Assistant" }),
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { role: 'ai', content: data.response, reactions: {} }]);
        } catch {
            setChatHistory(prev => [...prev, { role: 'ai', content: "❌ Error connecting to server", reactions: {} }]);
        } finally {
            setAiLoading(false);
        }
    };

    // Regenerate last AI response
    const regenerateResponse = async () => {
        const lastUserIdx = [...chatHistory].reverse().findIndex(m => m.role === 'user');
        if (lastUserIdx === -1) return;
        const idx = chatHistory.length - 1 - lastUserIdx;
        const userMsg = chatHistory[idx].content;
        // Remove everything after the last user message
        setChatHistory(prev => prev.slice(0, idx + 1));
        setAiLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, system_prompt: "Assistant" }),
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { role: 'ai', content: data.response, reactions: {} }]);
        } catch {
            setChatHistory(prev => [...prev, { role: 'ai', content: "❌ Error connecting to server", reactions: {} }]);
        } finally {
            setAiLoading(false);
        }
    };

    // Edit message & re-send
    const submitEdit = async (index) => {
        if (!editText.trim()) return;
        const newHistory = chatHistory.slice(0, index);
        newHistory.push({ role: 'user', content: editText, reactions: {} });
        setChatHistory(newHistory);
        setEditingMsgIndex(null);
        setEditText('');
        setAiLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: editText, system_prompt: "Assistant" }),
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { role: 'ai', content: data.response, reactions: {} }]);
        } catch {
            setChatHistory(prev => [...prev, { role: 'ai', content: "❌ Error connecting to server", reactions: {} }]);
        } finally {
            setAiLoading(false);
        }
    };

    // Reactions
    const toggleReaction = (index, emoji) => {
        setChatHistory(prev => prev.map((m, i) => {
            if (i !== index) return m;
            const reactions = { ...(m.reactions || {}) };
            reactions[emoji] = !reactions[emoji];
            return { ...m, reactions };
        }));
    };

    // Session management
    const startNewChat = () => {
        if (chatHistory.length > 0) {
            const firstUser = chatHistory.find(m => m.role === 'user');
            const title = firstUser ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '') : 'New Chat';
            setChatSessions(prev => [{
                id: Date.now(), title, messages: chatHistory,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                pinned: false, folder: 'default',
            }, ...prev]);
        }
        setChatHistory([]);
        setActiveTab('ask-ai');
    };

    const loadSession = (session) => { setChatHistory(session.messages); setActiveTab('ask-ai'); };
    const deleteSession = (id) => setChatSessions(prev => prev.filter(s => s.id !== id));

    // Rename
    const submitRename = (id) => {
        if (!renameText.trim()) { setRenamingId(null); return; }
        setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title: renameText } : s));
        setRenamingId(null); setRenameText('');
    };

    // Pin
    const togglePin = (id) => {
        setChatSessions(prev => prev.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s));
    };

    // Move to folder
    const moveToFolder = (sessionId, folderId) => {
        setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folder: folderId } : s));
    };

    // Add folder
    const addFolder = () => {
        if (!newFolderName.trim()) return;
        setFolders(prev => [...prev, { id: `f_${Date.now()}`, name: newFolderName }]);
        setNewFolderName(''); setShowNewFolder(false);
    };

    // Delete folder (moves sessions to General)
    const deleteFolder = (id) => {
        if (id === 'default') return;
        setChatSessions(prev => prev.map(s => s.folder === id ? { ...s, folder: 'default' } : s));
        setFolders(prev => prev.filter(f => f.id !== id));
    };

    // Export as TXT
    const exportChat = (session) => {
        const lines = session.messages.map(m => `[${m.role === 'user' ? 'You' : 'AI'}]: ${m.content}`).join('\n\n');
        const blob = new Blob([`Chat: ${session.title}\nExported: ${new Date().toLocaleString()}\n\n${lines}`], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${session.title.replace(/[^a-z0-9]/gi, '_')}.txt`; a.click();
    };

    // Toggle folder collapse
    const toggleFolder = (id) => setCollapsedFolders(prev => ({ ...prev, [id]: !prev[id] }));

    // Filtered & sorted sessions
    const getFilteredSessions = () => {
        let sessions = chatSessions;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            sessions = sessions.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.messages.some(m => m.content.toLowerCase().includes(q))
            );
        }
        return sessions.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    };

    // Markdown components with syntax highlighting
    const mdComponents = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                <div style={{ position: 'relative' }}>
                    <button onClick={() => copyText(String(children))} style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: 'rgba(255,255,255,0.6)', padding: '4px 8px',
                        borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                    }}>Copy</button>
                    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
                        customStyle={{ borderRadius: '10px', fontSize: '13px', margin: '8px 0' }}
                        {...props}>
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }} {...props}>
                    {children}
                </code>
            );
        }
    };

    // ===== SIDEBAR ITEMS =====
    const sidebarItems = [
        { id: 'ask-ai', label: 'Ask AI', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
        { id: 'chat-history', label: 'Chat History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
        { id: 'new-chat', label: 'New Chat', icon: 'M12 4v16m8-8H4' },
    ];

    // ===== RENDER CHAT HISTORY TAB =====
    const renderChatHistory = () => {
        const filtered = getFilteredSessions();

        return (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Search Bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px', padding: '10px 16px', marginBottom: '20px',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        placeholder="Search conversations..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '14px', outline: 'none' }}
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px' }}>✕</button>}
                </div>

                {/* Folder Management */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {folders.map(f => (
                        <div key={f.id} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#a5b4fc',
                        }}>
                            📁 {f.name}
                            {f.id !== 'default' && <button onClick={() => deleteFolder(f.id)} style={{
                                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                                cursor: 'pointer', fontSize: '12px', padding: '0 2px',
                            }}>✕</button>}
                        </div>
                    ))}
                    {showNewFolder ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addFolder()}
                                placeholder="Folder name" autoFocus
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 10px', color: '#fff', fontSize: '12px', outline: 'none', width: '120px' }}
                            />
                            <button onClick={addFolder} style={{ background: 'rgba(99,102,241,0.2)', border: 'none', color: '#818cf8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Add</button>
                            <button onClick={() => setShowNewFolder(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </div>
                    ) : (
                        <button onClick={() => setShowNewFolder(true)} style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)',
                            borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                        }}>+ New Folder</button>
                    )}
                </div>

                {/* Sessions grouped by folder */}
                {filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '16px' }}>💬</div>
                        <p style={{ fontSize: '16px', fontWeight: '500' }}>{searchQuery ? 'No matching conversations' : 'No conversations yet'}</p>
                        <p style={{ fontSize: '13px', marginTop: '6px' }}>{searchQuery ? 'Try a different search term.' : 'Start chatting with Ask AI to see your history here.'}</p>
                    </div>
                ) : (
                    folders.map(folder => {
                        const folderSessions = filtered.filter(s => (s.folder || 'default') === folder.id);
                        if (folderSessions.length === 0) return null;
                        const isCollapsed = collapsedFolders[folder.id];
                        return (
                            <div key={folder.id} style={{ marginBottom: '20px' }}>
                                <button onClick={() => toggleFolder(folder.id)} style={{
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
                                }}>
                                    <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: '0.2s', display: 'inline-block' }}>▼</span>
                                    📁 {folder.name} ({folderSessions.length})
                                </button>
                                {!isCollapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                                        {folderSessions.map((session) => (
                                            <div key={session.id} style={{
                                                padding: '14px 18px', borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${session.pinned ? 'rgba(250,204,21,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                                transition: 'all 0.2s',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                    {/* Pin */}
                                                    <button onClick={() => togglePin(session.id)} title={session.pinned ? 'Unpin' : 'Pin'} style={{
                                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                                                        color: session.pinned ? '#facc15' : 'rgba(255,255,255,0.25)', flexShrink: 0,
                                                    }}>📌</button>

                                                    {/* Title / Rename */}
                                                    <div onClick={() => loadSession(session)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                                                        {renamingId === session.id ? (
                                                            <input value={renameText} onChange={(e) => setRenameText(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && submitRename(session.id)}
                                                                onBlur={() => submitRename(session.id)} autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '14px', outline: 'none', width: '100%' }}
                                                            />
                                                        ) : (
                                                            <div style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</div>
                                                        )}
                                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>{session.time} · {session.messages.length} messages</div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button onClick={() => { setRenamingId(session.id); setRenameText(session.title); }} title="Rename" style={actionBtnStyle}>✏️</button>
                                                        <button onClick={() => exportChat(session)} title="Export" style={actionBtnStyle}>📥</button>
                                                        {/* Folder select */}
                                                        <select value={session.folder || 'default'} onChange={(e) => moveToFolder(session.id, e.target.value)}
                                                            title="Move to folder"
                                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '4px', cursor: 'pointer', outline: 'none' }}>
                                                            {folders.map(f => <option key={f.id} value={f.id} style={{ background: '#1a1b2e' }}>{f.name}</option>)}
                                                        </select>
                                                        <button onClick={() => deleteSession(session.id)} title="Delete" style={{ ...actionBtnStyle, color: '#f87171' }}>🗑️</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        );
    };

    // ===== RENDER ASK AI TAB =====
    const renderAskAI = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 85px)' }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chatHistory.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'rgba(255,255,255,0.3)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>✨</div>
                        <p style={{ fontSize: '16px' }}>Ask me anything!</p>
                        <p style={{ fontSize: '13px' }}>I'm here to help you with your questions.</p>
                    </div>
                )}
                {chatHistory.map((chat, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: chat.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '75%' }}>
                            {/* Edit mode for user messages */}
                            {editingMsgIndex === i && chat.role === 'user' ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                                        rows={3} style={{
                                            flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(99,102,241,0.4)',
                                            borderRadius: '12px', padding: '10px 14px', color: '#fff', fontSize: '14px',
                                            outline: 'none', resize: 'none', fontFamily: 'inherit',
                                        }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <button onClick={() => submitEdit(i)} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Send</button>
                                        <button onClick={() => setEditingMsgIndex(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Message bubble */}
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '14px',
                                        background: chat.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
                                        color: 'white', fontSize: '14px', lineHeight: '1.6',
                                        border: chat.role === 'ai' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    }}>
                                        {/* Attached image */}
                                        {chat.attachment?.preview && (
                                            <img src={chat.attachment.preview} alt="attached" style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '8px', display: 'block' }} />
                                        )}
                                        {chat.attachment && !chat.attachment.preview && (
                                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>📎 {chat.attachment.name}</div>
                                        )}
                                        <ReactMarkdown components={mdComponents}>{chat.content}</ReactMarkdown>
                                    </div>

                                    {/* Action buttons under message */}
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', justifyContent: chat.role === 'user' ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                                        {/* Copy */}
                                        <button onClick={() => copyText(chat.content)} title="Copy" style={msgActionStyle}>📋</button>

                                        {/* TTS for AI */}
                                        {chat.role === 'ai' && (
                                            <button onClick={() => speakText(chat.content)} title="Read aloud" style={msgActionStyle}>🔊</button>
                                        )}

                                        {/* Edit for user */}
                                        {chat.role === 'user' && (
                                            <button onClick={() => { setEditingMsgIndex(i); setEditText(chat.content); }} title="Edit" style={msgActionStyle}>✏️</button>
                                        )}

                                        {/* Regenerate on last AI */}
                                        {chat.role === 'ai' && i === chatHistory.length - 1 && (
                                            <button onClick={regenerateResponse} title="Regenerate" style={msgActionStyle}>🔄</button>
                                        )}

                                        {/* Reactions for AI */}
                                        {chat.role === 'ai' && (
                                            <>
                                                <button onClick={() => toggleReaction(i, '👍')} style={{ ...msgActionStyle, ...(chat.reactions?.['👍'] ? { background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.4)' } : {}) }}>👍</button>
                                                <button onClick={() => toggleReaction(i, '👎')} style={{ ...msgActionStyle, ...(chat.reactions?.['👎'] ? { background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' } : {}) }}>👎</button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {aiLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                            <span className="thinking-dots">Thinking</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Attachment preview */}
            {attachedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', marginTop: '8px' }}>
                    {attachedPreview ? <img src={attachedPreview} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} /> : <span>📎</span>}
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', flex: 1 }}>{attachedFile.name}</span>
                    <button onClick={clearAttachment} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleAsk} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px', padding: '6px 6px 6px 14px', marginTop: '10px',
            }}>
                {/* File upload */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.txt,.doc,.docx" />
                <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file" style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0, transition: 'all 0.2s',
                }}>📎</button>

                <input
                    style={{ flex: 1, background: 'none', border: 'none', color: 'white', padding: '10px 0', outline: 'none', fontSize: '14px' }}
                    placeholder="Ask anything..." value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />

                {/* Voice */}
                <button type="button" onClick={toggleVoice} title={isListening ? 'Stop listening' : 'Voice input'} style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: isListening ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)',
                    border: isListening ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: isListening ? '#f87171' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                </button>

                {/* Send */}
                <button type="submit" disabled={aiLoading} style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: (question.trim() || attachedFile) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                    border: 'none', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 'bold', transition: 'all 0.2s', flexShrink: 0,
                }}>↑</button>
            </form>
        </div>
    );

    // ===== MAIN RENDER =====
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e2e8f0' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
                .thinking-dots::after { content: '...'; animation: pulse 1.5s infinite; }
            `}</style>

            {/* Sidebar */}
            <aside style={{
                width: sidebarOpen ? '260px' : '72px',
                background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease',
                position: 'relative', flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    </div>
                    {sidebarOpen && <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px' }}>Dashboard</span>}
                </div>

                {/* Nav */}
                <nav style={{ padding: '12px', flex: 1 }}>
                    {sidebarItems.map((item) => (
                        <button key={item.id}
                            onClick={() => item.id === 'new-chat' ? startNewChat() : setActiveTab(item.id)}
                            style={{
                                width: '100%', padding: sidebarOpen ? '11px 14px' : '11px',
                                borderRadius: '10px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '12px',
                                marginBottom: '4px', transition: 'all 0.2s',
                                background: activeTab === item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                color: activeTab === item.id ? '#818cf8' : 'rgba(255,255,255,0.5)',
                                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                            }}
                            onMouseEnter={(e) => { if (activeTab !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { if (activeTab !== item.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={item.icon} /></svg>
                            {sidebarOpen && <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                {/* Sidebar Toggle */}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: 'absolute', top: '28px', right: '-14px', width: '28px', height: '28px', borderRadius: '50%', background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={sidebarOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} /></svg>
                </button>

                {/* Logout */}
                <button onClick={handleLogout} style={{
                    margin: '0 12px 8px', padding: sidebarOpen ? '11px 14px' : '11px',
                    borderRadius: '10px', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'rgba(239,68,68,0.1)', color: '#f87171',
                    justifyContent: sidebarOpen ? 'flex-start' : 'center', transition: 'all 0.2s',
                }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    {sidebarOpen && <span style={{ fontSize: '14px', fontWeight: '500' }}>Logout</span>}
                </button>

                {/* User */}
                <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', flexShrink: 0 }}>
                        {userName[0]?.toUpperCase()}
                    </div>
                    {sidebarOpen && (
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main */}
            <main style={{ flex: 1, overflow: 'auto' }}>
                <header style={{
                    padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
                    position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(10px)',
                }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                            {activeTab === 'ask-ai' ? <><span style={{ color: '#818cf8' }}>✨ Ask AI</span> Assistant</> : <><span style={{ color: '#818cf8' }}>💬</span> Chat History</>}
                        </h1>
                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                            {activeTab === 'ask-ai' ? 'Chat with AI to get instant help' : 'Browse your previous conversations'}
                        </p>
                    </div>
                </header>
                <div style={{ padding: '28px 32px' }}>
                    {activeTab === 'ask-ai' ? renderAskAI() : renderChatHistory()}
                </div>
            </main>
        </div>
    );
};

// Shared styles
const msgActionStyle = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px', padding: '4px 8px', fontSize: '13px',
    cursor: 'pointer', color: 'rgba(255,255,255,0.5)', transition: 'all 0.2s',
};

const actionBtnStyle = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px', padding: '4px 8px', fontSize: '13px',
    cursor: 'pointer', transition: 'all 0.2s',
};

export default Dashboard;