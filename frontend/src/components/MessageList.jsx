import { useState } from "react";
import { summarizeMessages } from "../services/api";

// Endpoint helper
const extractTasks = async (messages) => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const res = await fetch("http://localhost:8080/api/tasks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: messages.map(m => ({
                sender: m.sender,
                content: m.decrypted,
            })),
            timezone: [userTimezone],
        }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
};

const MessageList = ({ messages, currentUsername, selectedUser }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Track selected messages
    const [selectedMessages, setSelectedMessages] = useState([]);

    const filteredMessages = messages.filter(
        m =>
            (m.sender === currentUsername && m.recipient === selectedUser) ||
            (m.sender === selectedUser && m.recipient === currentUsername)
    );

    // Handle summarization
    const handleSummarize = async () => {
        setLoading(true);
        try {
            const result = await summarizeMessages(filteredMessages);
            setSummary(result.summary); // API now returns { summary: "..." }
            setShowSummary(true);
        } catch (err) {
            alert("Failed to summarize chat");
        }
        setLoading(false);
    };

    // Handle task extraction
    const handleExtractTask = async () => {
        try {
            const task = await extractTasks(selectedMessages);
            alert(`Task created: ${task.taskTitle} (deadline: ${task.deadline})`);
            setSelectedMessages([]); // clear after submission
        } catch (err) {
            alert("Failed to extract task");
        }
    };

    return (
        <div style={{ display: "flex", height: "100%" }}>
            {/* Left: Chat messages */}
            <div style={{ flex: 1, marginRight: showSummary ? 10 : 0 }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                    }}
                >
                    <h3 style={{ margin: 0 }}>Messages</h3>
                    {selectedUser && (
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={handleSummarize} disabled={loading}>
                                {loading ? "Summarizing..." : "Summarize Chat"}
                            </button>
                            <button
                                onClick={handleExtractTask}
                                disabled={selectedMessages.length === 0}
                            >
                                Extract Task
                            </button>
                        </div>
                    )}
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        border: "1px solid #ccc",
                        padding: 10,
                        borderRadius: 4,
                        height: 400,
                        overflowY: "auto",
                        backgroundColor: "#f9f9f9",
                    }}
                >
                    {!selectedUser ? (
                        <p style={{ color: "#666" }}>Select a user to start chatting</p>
                    ) : filteredMessages.length === 0 ? (
                        <p style={{ color: "#666" }}>
                            No conversation yet with {selectedUser}
                        </p>
                    ) : (
                        filteredMessages.map((m, i) => (
                            <div
                                key={i}
                                onClick={() =>
                                    setSelectedMessages(prev =>
                                        prev.includes(m)
                                            ? prev.filter(x => x !== m)
                                            : [...prev, m]
                                    )
                                }
                                style={{
                                    alignSelf:
                                        m.sender === currentUsername
                                            ? "flex-end"
                                            : "flex-start",
                                    backgroundColor: selectedMessages.includes(m)
                                        ? "#ffe082" // highlight if selected
                                        : m.sender === currentUsername
                                            ? "#dcf8c6"
                                            : "#ffffff",
                                    padding: 10,
                                    borderRadius: 8,
                                    maxWidth: "75%",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                    cursor: "pointer",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: 12,
                                        color: "#555",
                                        marginBottom: 4,
                                        width: "100%",
                                        gap: 10,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {m.sender === currentUsername ? "You" : m.sender}
                                    <span style={{ float: "right" }}>
                                        {new Date(m.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div>{m.decrypted}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Collapsible summary sidebar */}
            {summary && showSummary && (
                <div
                    style={{
                        width: 300,
                        borderLeft: "1px solid #ccc",
                        padding: 10,
                        borderRadius: 4,
                        backgroundColor: "#fff",
                        overflowY: "auto",
                        transition: "all 0.3s ease",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ margin: 0 }}>Chat Summary</h4>
                        <button onClick={() => setShowSummary(false)}>✖</button>
                    </div>
                    <p>{summary}</p>
                </div>
            )}
        </div>
    );
};

export default MessageList;
