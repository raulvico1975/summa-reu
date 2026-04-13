'use client'

import { Sparkles, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function CreateJobModal({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  onPromptChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg !overflow-hidden !p-0">
        <div className="p-6">
          <DialogHeader className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl tracking-[-0.03em]">✨ Demanar Leads a l&apos;IA</DialogTitle>
              <DialogDescription>
                Escriu el prompt de cerca i el sistema crearà un job a Firestore. El worker VPS el recollirà després.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-6 space-y-2">
            <Label htmlFor="growth-job-prompt">Prompt de recerca</Label>
            <Textarea
              id="growth-job-prompt"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Ex: busca entitats amb necessitats de donacions recurrents i web millorable"
              className="min-h-[200px]"
            />
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel·lar
            </Button>
            <Button
              variant="outline"
              onClick={onSubmit}
              disabled={isSubmitting || !prompt.trim()}
              className="!border-purple-600 !bg-purple-600 !text-white hover:!bg-purple-500 hover:!text-white"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Iniciar Cerca
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
