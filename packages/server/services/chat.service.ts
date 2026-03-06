import OpenAI from 'openai';
import { conversationRepository } from '../repositories/conversation.repository';
import template from '../prompts/chatbot.txt';
import { fishingService } from './fishing.service';
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
      const tools: OpenAI.Responses.Tool[] = [
         {
            type: 'function',
            name: 'get_fishing_conditions',
            description:
               'Get live fishing conditions (including weather) for a location name.',
            parameters: {
               type: 'object',
               properties: {
                  locationName: {
                     type: 'string',
                     description:
                        'City or location to check fishing weather conditions for.',
                  },
               },
               required: ['locationName'],
               additionalProperties: false,
            },
            strict: true,
         },
      ];
      let response = await client.responses.create({
         model: 'gpt-4o-mini',
         instructions,
         input: prompt,
         tools,
         temperature: 0.2,
         max_output_tokens: 200,
         previous_response_id:
            conversationRepository.getLastResponseId(conversationId),
      });

      while (true) {
         const functionCalls = response.output.filter(
            (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
               item.type === 'function_call' &&
               item.name === 'get_fishing_conditions'
         );

         if (functionCalls.length === 0) {
            break;
         }

         const toolOutputs = await Promise.all(
            functionCalls.map(async (toolCall) => {
               try {
                  const args = JSON.parse(toolCall.arguments) as {
                     locationName?: string;
                  };
                  if (!args.locationName) {
                     throw new Error('locationName is required.');
                  }

                  const conditions = await fishingService.getFishingConditions(
                     args.locationName
                  );

                  return {
                     type: 'function_call_output' as const,
                     call_id: toolCall.call_id,
                     output: JSON.stringify(conditions),
                  };
               } catch (error) {
                  const message =
                     error instanceof Error
                        ? error.message
                        : 'Unexpected tool execution error.';

                  return {
                     type: 'function_call_output' as const,
                     call_id: toolCall.call_id,
                     output: JSON.stringify({ error: message }),
                  };
               }
            })
         );

         response = await client.responses.create({
            model: 'gpt-4o-mini',
            instructions,
            tools,
            input: toolOutputs,
            temperature: 0.2,
            max_output_tokens: 200,
            previous_response_id: response.id,
         });
      }

      conversationRepository.setLastResponseId(conversationId, response.id);
      return {
         id: response.id,
         message: response.output_text,
      };
   },
};
