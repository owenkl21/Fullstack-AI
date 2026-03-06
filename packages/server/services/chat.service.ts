import OpenAI from 'openai';
import { conversationRepository } from '../repositories/conversation.repository';
import template from '../prompts/chatbot.txt';
// Initialize OpenAI client with API key from environment variables
const client = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY,
});

// instructions for the chatbot, can be used to set the context of the conversation
const instructions = template;

interface ChatResponse {
   id: string;
   message: string;
}

export const chatService = {
   async sendMessage(
      prompt: string,
      conversationId: string
   ): Promise<ChatResponse> {
      const response = await client.responses.create({
         model: 'gpt-4o-mini',
         instructions,
         input: prompt,
         temperature: 0.2,
         max_output_tokens: 200,
         previous_response_id:
            conversationRepository.getLastResponseId(conversationId),
      });

      conversationRepository.setLastResponseId(conversationId, response.id);
      return {
         id: response.id,
         message: response.output_text,
      };
   },
};
