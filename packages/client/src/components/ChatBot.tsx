import axios from 'axios';
import { useRef, useState } from 'react';
import { MdErrorOutline } from 'react-icons/md';
import TypingIndicator from './TypingIndicator';
import type { Message } from './ChatMessages';
import ChatMessages from './ChatMessages';
import ChatInput, { type ChatFormData } from './ChatInput';
import popSound from '@/assets/sounds/pop.mp3';
import notificationSound from '@/assets/sounds/notification.mp3';

type ChatResponse = {
   message: string;
};

const popAudio = new Audio(popSound);
popAudio.volume = 0.2;

const notificationAudio = new Audio(notificationSound);
notificationAudio.volume = 0.2;

const ChatBot = () => {
   const conversationId = useRef(crypto.randomUUID());

   const [error, setError] = useState('');
   const [messages, setMessages] = useState<Message[]>([]);
   const [isBotTyping, setIsBotTyping] = useState(false);

   const onSubmit = async ({ prompt }: ChatFormData) => {
      try {
         setMessages((prev) => [...prev, { content: prompt, role: 'user' }]);
         setIsBotTyping(true);
         setError('');
         popAudio.play();

         const { data } = await axios.post<ChatResponse>('/api/chat', {
            prompt,
            conversationId: conversationId.current,
         });
         setMessages((prev) => [
            ...prev,
            { content: data.message, role: 'bot' },
         ]);
         setIsBotTyping(false);
         notificationAudio.play();
      } catch (error) {
         console.error(error);
         setError('Something went wrong. Please try again.');
      } finally {
         setIsBotTyping(false);
      }
   };

   return (
      <div className="flex flex-col h-full">
         <div className="flex flex-col flex-1 gap-3 mb-4 overflow-y-auto scroll-bar-hide">
            <ChatMessages messages={messages} />
            {isBotTyping && <TypingIndicator />}
            {error && (
               <div className="flex items-center gap-2 p-2 bg-red-100 rounded-md border border-red-300 self-start">
                  <MdErrorOutline className="text-red-500" />
                  <p className="text-red-500">{error}</p>
               </div>
            )}
         </div>
         <ChatInput onSubmit={onSubmit} isBotTyping={isBotTyping} />
      </div>
   );
};

export default ChatBot;
