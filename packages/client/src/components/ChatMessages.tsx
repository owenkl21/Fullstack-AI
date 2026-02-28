import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export type Message = {
   content: string;
   role: 'user' | 'bot';
};
type Props = {
   messages: Message[];
};

const onCopy = (e: React.ClipboardEvent<HTMLParagraphElement>) => {
   const selection = window.getSelection()?.toString().trim();
   if (selection) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', selection);
   }
};

const ChatMessages = ({ messages }: Props) => {
   const lastMessageRef = useRef<HTMLParagraphElement>(null);
   useEffect(() => {
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);
   return (
      <div className="flex flex-col gap-3">
         {messages.map((message, index) => (
            <p
               key={index}
               onCopy={onCopy}
               ref={index === messages.length - 1 ? lastMessageRef : null}
               className={`px-3 py-1 rounded-md ${message.role === 'user' ? 'bg-blue-600 text-white self-end' : 'bg-gray-200 text-black self-start'}`}
            >
               <ReactMarkdown>{message.content}</ReactMarkdown>
            </p>
         ))}
      </div>
   );
};

export default ChatMessages;
