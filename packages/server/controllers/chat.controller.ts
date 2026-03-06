import type { Request, Response } from 'express';
import { chatService } from './../services/chat.service';
import z from 'zod';

const chatSchema = z.object({
   prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required.')
      .max(1000, 'Prompt must be less than 1000 characters.'),
   conversationId: z.string().uuid(),
});

export const chatController = {
   sendMessage: async (req: Request, res: Response) => {
      const parseResult = chatSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      try {
         const { prompt, conversationId } = parseResult.data;
         const response = await chatService.sendMessage(prompt, conversationId);

         return res.json({ message: response.message });
      } catch (error) {
         console.error('Failed to process /api/chat request:', error);
         return res.status(500).json({
            error: 'An error occurred while processing your request.',
         });
      }
   },
};
