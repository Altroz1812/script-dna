import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { X } from 'lucide-react';

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface ClassroomChatProps {
  onNewMessage?: () => void;
  onClose?: () => void;
}

export function ClassroomChat({ onNewMessage, onClose }: ClassroomChatProps) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== 'chat') return;
        setMessages(prev => [...prev, { sender: msg.sender, message: msg.message, timestamp: msg.timestamp }]);
        onNewMessage?.();
      } catch {
        // ignore non-JSON
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, onNewMessage]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const payload = {
      type: 'chat',
      sender: room.localParticipant.identity,
      message: text,
      timestamp: Date.now(),
    };

    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true }
    );

    // Add own message locally
    setMessages(prev => [...prev, { sender: payload.sender, message: text, timestamp: payload.timestamp }]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const myIdentity = room.localParticipant.identity;

  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Chat</span>
          {onClose && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} title="Close chat">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.sender === myIdentity;
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-muted-foreground mb-0.5">
                  {isMe ? 'You' : msg.sender} · {formatTime(msg.timestamp)}
                </span>
                <div className={`rounded-lg px-3 py-1.5 text-sm max-w-[90%] break-words ${
                  isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border shrink-0 flex gap-1.5">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="h-8 text-sm"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendMessage} disabled={!input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
