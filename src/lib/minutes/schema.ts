import { z } from "zod";

export const minutesDecisionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  owner: z.string().min(1).nullable(),
  dueDate: z.string().min(1).nullable(),
  tags: z.array(z.string()).default([]),
});

export const minutesTaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  owner: z.string().min(1).nullable(),
  dueDate: z.string().min(1).nullable(),
  status: z.enum(["todo", "doing", "done"]),
});

export const minutesJsonSchema = z.object({
  language: z.enum(["ca", "es"]),
  summary: z.string().min(1),
  attendees: z.array(z.string()),
  agenda: z.array(z.string()),
  decisions: z.array(minutesDecisionSchema),
  tasks: z.array(minutesTaskSchema),
});

export type MinutesJsonStrict = z.infer<typeof minutesJsonSchema>;
