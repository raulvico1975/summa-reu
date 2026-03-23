'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  orderBy,
  query,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Upload,
  Megaphone,
  EyeOff,
  Check,
  Pencil,
  ExternalLink,
  FileJson,
  X,
  Sparkles,
  Copy,
  MoreVertical,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-is-mobile';

import { stripUndefined, stripUndefinedDeep } from '@/lib/firestore-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Tipus IA
// ─────────────────────────────────────────────────────────────────────────────

type AIGeneratedContent = {
  contentLong: string;
  web?: {
    excerpt: string;
    content: string;
  };
  social?: {
    xText: string;
    linkedinText: string;
  };
  image?: {
    prompt: string;
    altText: string;
  };
  analysis: {
    clarityScore: number;
    techRisk: 'low' | 'medium' | 'high';
    recommendation: 'PUBLICAR' | 'REVISAR' | 'NO_PUBLICAR';
    notes: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

type DraftItem = {
  id: string;
  title: string;
  description: string;
  link: string | null;
  evidence?: string[];
  status: 'draft' | 'published' | 'discarded';
  createdAt?: string;
};

/**
 * Schema ampliat per productUpdates.
 * Camps nous són opcionals per compatibilitat.
 */
type PublishedUpdate = {
  id: string;
  title: string;
  description: string;
  link: string | null;
  publishedAt: Date;
  isActive?: boolean; // soft delete: false = despublicat
  createdAt?: Date;

  // NOU - Detall app (TEXT PLA, NO HTML)
  contentLong?: string | null;
  guideUrl?: string | null;
  videoUrl?: string | null;

  // NOU - Web
  web?: {
    enabled: boolean;
    slug: string;
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
    publishedAt?: Date;
  } | null;

  // NOU - Social
  social?: {
    enabled: boolean;
    xText?: string | null;
    linkedinText?: string | null;
    linkUrl?: string | null;
  } | null;

  // NOU - IA
  ai?: {
    input?: {
      changeBrief: string;
      problemReal: string;
      affects: string;
      userAction: string;
    } | null;
    analysis?: {
      clarityScore?: number;
      techRisk?: 'low' | 'medium' | 'high';
      recommendation?: 'PUBLICAR' | 'REVISAR' | 'NO_PUBLICAR';
      notes?: string | null;
    } | null;
  } | null;

  // NOU - Imatge (Fase 5)
  image?: {
    enabled: boolean;
    prompt?: string | null;
    altText?: string | null;
    storagePath?: string | null;
  } | null;
};

type DraftsImport = {
  generatedAt: string;
  range: string;
  drafts: Array<{
    id: string;
    title: string;
    description: string;
    link: string | null;
    evidence?: string[];
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ProductUpdatesSectionProps {
  /** Gating: Only SuperAdmin can query productUpdateDrafts/productUpdates */
  isSuperAdmin?: boolean;
}

export function ProductUpdatesSection({ isSuperAdmin = false }: ProductUpdatesSectionProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Tab actiu controlat per Select/Tabs
  const [activeTab, setActiveTab] = React.useState<string>('drafts');

  // Estat (sempre declarar hooks abans de qualsevol early return!)
  const [isImporting, setIsImporting] = React.useState(false);
  const [editingDraft, setEditingDraft] = React.useState<DraftItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editLink, setEditLink] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState<string | null>(null);
  const [isDiscarding, setIsDiscarding] = React.useState<string | null>(null);
  const [isUnpublishing, setIsUnpublishing] = React.useState<string | null>(null);

  // Estat per crear amb IA
  const [aiTitle, setAiTitle] = React.useState('');
  const [aiDescription, setAiDescription] = React.useState('');
  const [aiLink, setAiLink] = React.useState('');
  const [aiChangeBrief, setAiChangeBrief] = React.useState('');
  const [aiProblemReal, setAiProblemReal] = React.useState('');
  const [aiAffects, setAiAffects] = React.useState('');
  const [aiUserAction, setAiUserAction] = React.useState('');
  const [webEnabled, setWebEnabled] = React.useState(false);
  const [socialEnabled, setSocialEnabled] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isPublishingAI, setIsPublishingAI] = React.useState(false);
  const [generatedContent, setGeneratedContent] = React.useState<AIGeneratedContent | null>(null);
  const [previewTab, setPreviewTab] = React.useState<'app' | 'web' | 'x' | 'linkedin'>('app');

  // Col·leccions - CRÍTIC: retornar null si no és superadmin per evitar permission denied
  const draftsQuery = useMemoFirebase(
    () => isSuperAdmin
      ? query(collection(firestore, 'productUpdateDrafts'), orderBy('createdAt', 'desc'))
      : null,
    [firestore, isSuperAdmin]
  );
  // Només mostrar publicades actives (isActive !== false)
  // Nota: Simplificat per evitar problemes amb col·lecció buida
  const publishedQuery = useMemoFirebase(
    () => isSuperAdmin
      ? query(
          collection(firestore, 'productUpdates'),
          orderBy('publishedAt', 'desc')
        )
      : null,
    [firestore, isSuperAdmin]
  );

  const { data: allDrafts, isLoading: isLoadingDrafts } = useCollection<DraftItem>(draftsQuery);
  const { data: allPublished, isLoading: isLoadingPublished } = useCollection<PublishedUpdate>(publishedQuery);

  // Filtrar publicades actives al client (isActive !== false)
  const published = React.useMemo(() => {
    if (!allPublished) return null;
    return allPublished.filter(u => u.isActive !== false);
  }, [allPublished]);

  // Filtrar esborranys actius (no publicats ni descartats)
  const activeDrafts = React.useMemo(() => {
    if (!allDrafts) return [];
    return allDrafts.filter(d => d.status === 'draft');
  }, [allDrafts]);

  // GATING: No renderitzar res si no és superadmin
  // (els hooks ja retornen null, però això evita renderitzar la UI)
  if (!isSuperAdmin) {
    return null;
  }

  // Handler importar JSON
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as DraftsImport;

      // Validar estructura
      if (!data.drafts || !Array.isArray(data.drafts)) {
        throw new Error('Format JSON invàlid: falta array "drafts"');
      }

      // Obtenir IDs existents per evitar duplicats
      const existingSnap = await getDocs(collection(firestore, 'productUpdateDrafts'));
      const existingIds = new Set(existingSnap.docs.map(d => d.id));

      // Inserir nous drafts
      const batch = writeBatch(firestore);
      let insertedCount = 0;
      let skippedCount = 0;

      for (const draft of data.drafts) {
        // Validar camps requerits
        if (!draft.id || !draft.title || !draft.description) {
          console.warn('Draft invàlid, saltant:', draft);
          skippedCount++;
          continue;
        }

        // Saltar si ja existeix
        if (existingIds.has(draft.id)) {
          skippedCount++;
          continue;
        }

        // Validar longitud
        if (draft.title.length > 60) {
          console.warn(`Títol massa llarg (${draft.title.length} chars), truncant:`, draft.id);
          draft.title = draft.title.slice(0, 60);
        }
        if (draft.description.length > 140) {
          console.warn(`Descripció massa llarga (${draft.description.length} chars), truncant:`, draft.id);
          draft.description = draft.description.slice(0, 140);
        }

        const docRef = doc(firestore, 'productUpdateDrafts', draft.id);
        batch.set(docRef, stripUndefined({
          id: draft.id,
          title: draft.title,
          description: draft.description,
          link: draft.link ?? null,
          evidence: draft.evidence ?? [],
          status: 'draft',
          createdAt: new Date().toISOString(),
        }));
        insertedCount++;
      }

      if (insertedCount > 0) {
        await batch.commit();
      }

      toast({
        title: 'Importació completada',
        description: `${insertedCount} esborranys importats${skippedCount > 0 ? `, ${skippedCount} saltats (duplicats o invàlids)` : ''}.`,
      });
    } catch (error) {
      console.error('Error importar JSON:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No s\'ha pogut importar el fitxer.',
      });
    } finally {
      setIsImporting(false);
      // Reset input
      e.target.value = '';
    }
  };

  // Handler obrir editar
  const handleEditDraft = (draft: DraftItem) => {
    setEditingDraft(draft);
    setEditTitle(draft.title);
    setEditDescription(draft.description);
    setEditLink(draft.link || '');
    setIsEditDialogOpen(true);
  };

  // Handler guardar edició
  const handleSaveEdit = async () => {
    if (!editingDraft) return;

    // Validar
    if (!editTitle.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El títol és obligatori.' });
      return;
    }
    if (editTitle.length > 60) {
      toast({ variant: 'destructive', title: 'Error', description: 'El títol ha de tenir màxim 60 caràcters.' });
      return;
    }
    if (!editDescription.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'La descripció és obligatòria.' });
      return;
    }
    if (editDescription.length > 140) {
      toast({ variant: 'destructive', title: 'Error', description: 'La descripció ha de tenir màxim 140 caràcters.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'productUpdateDrafts', editingDraft.id), {
        title: editTitle.trim(),
        description: editDescription.trim(),
        link: editLink.trim() || null,
      });

      toast({ title: 'Esborrany actualitzat' });
      setIsEditDialogOpen(false);
      setEditingDraft(null);
    } catch (error) {
      console.error('Error guardar esborrany:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler publicar
  const handlePublish = async (draft: DraftItem) => {
    setIsPublishing(draft.id);
    try {
      // Crear a productUpdates amb isActive: true
      const updateId = `update-${Date.now()}`;
      await setDoc(doc(firestore, 'productUpdates', updateId), stripUndefined({
        id: updateId,
        title: draft.title,
        description: draft.description,
        link: draft.link ?? null,
        publishedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        isActive: true,
      }));

      // Marcar draft com publicat
      await updateDoc(doc(firestore, 'productUpdateDrafts', draft.id), {
        status: 'published',
      });

      toast({
        title: 'Novetat publicada',
        description: 'Els usuaris la veuran a la campaneta de novetats.',
      });
    } catch (error) {
      console.error('Error publicar:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut publicar.' });
    } finally {
      setIsPublishing(null);
    }
  };

  // Handler descartar
  const handleDiscard = async (draft: DraftItem) => {
    setIsDiscarding(draft.id);
    try {
      await updateDoc(doc(firestore, 'productUpdateDrafts', draft.id), {
        status: 'discarded',
      });
      toast({ title: 'Esborrany descartat' });
    } catch (error) {
      console.error('Error descartar:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut descartar.' });
    } finally {
      setIsDiscarding(null);
    }
  };

  // Handler despublicar (soft delete)
  const handleUnpublish = async (update: PublishedUpdate) => {
    setIsUnpublishing(update.id);
    try {
      await updateDoc(doc(firestore, 'productUpdates', update.id), {
        isActive: false,
      });
      toast({ title: 'Novetat despublicada', description: 'Els usuaris ja no la veuran.' });
    } catch (error) {
      console.error('Error despublicar:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut despublicar.' });
    } finally {
      setIsUnpublishing(null);
    }
  };

  // Handler generar contingut amb IA
  const handleGenerateAI = async () => {
    if (!aiTitle.trim() || !aiDescription.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Títol i descripció són obligatoris.' });
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const response = await fetch('/api/ai/generate-product-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiTitle.trim(),
          description: aiDescription.trim(),
          aiInput: {
            changeBrief: aiChangeBrief.trim() || undefined,
            problemReal: aiProblemReal.trim() || undefined,
            affects: aiAffects.trim() || undefined,
            userAction: aiUserAction.trim() || undefined,
          },
          webEnabled,
          socialEnabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error generant contingut');
      }

      const data = await response.json() as AIGeneratedContent;
      setGeneratedContent(data);
      toast({ title: 'Contingut generat', description: 'Revisa el preview abans de publicar.' });
    } catch (error) {
      console.error('Error generar IA:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No s\'ha pogut generar contingut.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler publicar des d'IA
  const handlePublishAI = async () => {
    if (!generatedContent || !aiTitle.trim() || !aiDescription.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Genera contingut primer.' });
      return;
    }

    setIsPublishingAI(true);
    try {
      const updateId = `update-${Date.now()}`;
      const slug = aiTitle.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const updateData = stripUndefinedDeep({
        id: updateId,
        title: aiTitle.trim(),
        description: aiDescription.trim(),
        link: aiLink.trim() || null,
        publishedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        isActive: true,
        contentLong: generatedContent.contentLong,
        ai: {
          input: {
            changeBrief: aiChangeBrief.trim() || null,
            problemReal: aiProblemReal.trim() || null,
            affects: aiAffects.trim() || null,
            userAction: aiUserAction.trim() || null,
          },
          analysis: generatedContent.analysis,
        },
        web: webEnabled && generatedContent.web ? {
          enabled: true,
          slug,
          excerpt: generatedContent.web.excerpt,
          content: generatedContent.web.content,
        } : null,
        social: socialEnabled && generatedContent.social ? {
          enabled: true,
          xText: generatedContent.social.xText,
          linkedinText: generatedContent.social.linkedinText,
          linkUrl: webEnabled ? `https://summasocial.app/ca/novetats/${slug}` : null,
        } : null,
      });

      await setDoc(doc(firestore, 'productUpdates', updateId), updateData);

      toast({
        title: 'Novetat publicada',
        description: 'Els usuaris la veuran a la campaneta de novetats.',
      });

      // Reset form
      setAiTitle('');
      setAiDescription('');
      setAiLink('');
      setAiChangeBrief('');
      setAiProblemReal('');
      setAiAffects('');
      setAiUserAction('');
      setWebEnabled(false);
      setSocialEnabled(false);
      setGeneratedContent(null);
    } catch (error) {
      console.error('Error publicar IA:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut publicar.' });
    } finally {
      setIsPublishingAI(false);
    }
  };

  // Helper copiar text
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiat` });
  };

  // Exportar JSON per web públic (Fase 4)
  const handleExportWebJson = () => {
    if (!published || published.length === 0) {
      toast({ variant: 'destructive', title: 'Cap novetat', description: 'No hi ha novetats actives amb web.enabled' });
      return;
    }

    // Filtrar només updates amb web.enabled
    const webUpdates = published.filter(u => u.web?.enabled && u.web?.slug);
    if (webUpdates.length === 0) {
      toast({ variant: 'destructive', title: 'Cap novetat web', description: 'Activa web.enabled i slug a les novetats que vulguis publicar.' });
      return;
    }

    // Generar JSON per al web públic
    const exportData = {
      updates: webUpdates.map(u => ({
        id: u.id,
        title: u.web?.title || u.title,
        slug: u.web!.slug,
        excerpt: u.web?.excerpt || null,
        content: u.web?.content || u.contentLong || null,
        publishedAt: u.web?.publishedAt?.toISOString?.()?.slice(0, 10)
          || u.publishedAt?.toISOString?.()?.slice(0, 10)
          || null,
      })),
      generatedAt: new Date().toISOString(),
    };

    // Descarregar fitxer
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novetats-data.json';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'JSON exportat',
      description: `${webUpdates.length} novetats. Copia a public/novetats-data.json i fes commit.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" />
              Novetats
            </CardTitle>
            <CardDescription>
              Gestiona les novetats visibles per als usuaris
            </CardDescription>
          </div>
          {/* Mobile: CTA + dropdown */}
          {isMobile ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-json-mobile" className="cursor-pointer w-full">
                <Button variant="default" className="w-full" asChild disabled={isImporting}>
                  <span>
                    {isImporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Importar esborranys
                  </span>
                </Button>
              </Label>
              <input
                id="import-json-mobile"
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImportJson}
                disabled={isImporting}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <MoreVertical className="h-4 w-4 mr-2" />
                    Més accions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleExportWebJson}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Exportar per a la web
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            /* Desktop: row of buttons */
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1">
                <Button variant="outline" size="sm" onClick={handleExportWebJson}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Exportar per a la web
                </Button>
                <p className="text-[10px] text-muted-foreground max-w-[200px] text-right">
                  Prepara l’arxiu necessari per publicar les novetats al web
                </p>
              </div>
              <Label htmlFor="import-json" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={isImporting}>
                  <span>
                    {isImporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Importar esborranys
                  </span>
                </Button>
              </Label>
              <input
                id="import-json"
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImportJson}
                disabled={isImporting}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile: Select navigation */}
          {isMobile ? (
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full mb-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drafts">
                  Esborranys {activeDrafts.length > 0 && `(${activeDrafts.length})`}
                </SelectItem>
                <SelectItem value="published">
                  Publicades {published && published.length > 0 && `(${published.length})`}
                </SelectItem>
                <SelectItem value="create-ai">
                  Crear amb IA
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="mb-4">
              <TabsTrigger value="drafts">
                Esborranys
                {activeDrafts.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{activeDrafts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="published">
                Publicades
                {published && published.length > 0 && (
                  <Badge variant="outline" className="ml-2">{published.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="create-ai">
                <Sparkles className="h-4 w-4 mr-1" />
                Crear amb IA
              </TabsTrigger>
            </TabsList>
          )}

          {/* Tab Esborranys */}
          <TabsContent value="drafts">
            {isLoadingDrafts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregant...
              </div>
            ) : activeDrafts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileJson className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Cap esborrany pendent.</p>
                {!isMobile && (
                  <p className="text-xs mt-1">Executa <code className="bg-muted px-1 rounded">npm run updates:drafts</code> i importa el JSON.</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Títol</TableHead>
                    <TableHead>Descripció</TableHead>
                    <TableHead className="w-[180px]">Accions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeDrafts.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell className="font-medium">{draft.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {draft.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDraft(draft)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePublish(draft)}
                            disabled={isPublishing === draft.id}
                            title="Publicar"
                          >
                            {isPublishing === draft.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDiscard(draft)}
                            disabled={isDiscarding === draft.id}
                            className="text-destructive hover:text-destructive"
                            title="Descartar"
                          >
                            {isDiscarding === draft.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Tab Publicades */}
          <TabsContent value="published">
            {isLoadingPublished ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregant...
              </div>
            ) : !published || published.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Cap novetat publicada encara.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Títol</TableHead>
                    <TableHead>Descripció</TableHead>
                    <TableHead>Publicada</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {published.map((update) => (
                    <TableRow key={update.id}>
                      <TableCell className="font-medium">{update.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {update.description}
                        {update.link && (
                          <a
                            href={update.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline ml-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {update.publishedAt instanceof Date
                          ? update.publishedAt.toLocaleDateString('ca-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnpublish(update)}
                          disabled={isUnpublishing === update.id}
                          className="text-muted-foreground hover:text-foreground"
                          title="Despublicar"
                        >
                          {isUnpublishing === update.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Tab Crear amb IA */}
          <TabsContent value="create-ai">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Columna esquerra: Inputs */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-title">
                    Títol <span className="text-xs text-muted-foreground">(obligatori)</span>
                  </Label>
                  <Input
                    id="ai-title"
                    value={aiTitle}
                    onChange={(e) => setAiTitle(e.target.value)}
                    maxLength={60}
                    placeholder="Títol curt i descriptiu"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-description">
                    Descripció breu <span className="text-xs text-muted-foreground">(obligatori)</span>
                  </Label>
                  <Textarea
                    id="ai-description"
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    maxLength={140}
                    placeholder="Descripció que apareixerà a la campaneta"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-link">
                    Enllaç <span className="text-xs text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="ai-link"
                    value={aiLink}
                    onChange={(e) => setAiLink(e.target.value)}
                    placeholder="/dashboard/movimientos"
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Context addicional per IA (opcional)</p>

                  <div className="space-y-2">
                    <Label htmlFor="ai-change" className="text-xs">Què ha canviat?</Label>
                    <Input
                      id="ai-change"
                      value={aiChangeBrief}
                      onChange={(e) => setAiChangeBrief(e.target.value)}
                      placeholder="Nou botó per exportar, millora de rendiment..."
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-problem" className="text-xs">Problema que resol?</Label>
                    <Input
                      id="ai-problem"
                      value={aiProblemReal}
                      onChange={(e) => setAiProblemReal(e.target.value)}
                      placeholder="Abans calia fer-ho manualment..."
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-affects" className="text-xs">A qui afecta?</Label>
                    <Input
                      id="ai-affects"
                      value={aiAffects}
                      onChange={(e) => setAiAffects(e.target.value)}
                      placeholder="Tots els usuaris, administradors..."
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-action" className="text-xs">Acció de l'usuari?</Label>
                    <Input
                      id="ai-action"
                      value={aiUserAction}
                      onChange={(e) => setAiUserAction(e.target.value)}
                      placeholder="Anar a Moviments > Exportar..."
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="web-toggle">Publicar al web</Label>
                      <p className="text-xs text-muted-foreground">Genera contingut per /novetats</p>
                    </div>
                    <Switch
                      id="web-toggle"
                      checked={webEnabled}
                      onCheckedChange={setWebEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="social-toggle">Xarxes socials</Label>
                      <p className="text-xs text-muted-foreground">Genera copy per X i LinkedIn</p>
                    </div>
                    <Switch
                      id="social-toggle"
                      checked={socialEnabled}
                      onCheckedChange={setSocialEnabled}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !aiTitle.trim() || !aiDescription.trim()}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generant...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar contingut
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Columna dreta: Preview */}
              <div className="space-y-4">
                {generatedContent ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Preview</p>
                      <div className="flex gap-1">
                        <Button
                          variant={previewTab === 'app' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setPreviewTab('app')}
                        >
                          App
                        </Button>
                        {generatedContent.web && (
                          <Button
                            variant={previewTab === 'web' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewTab('web')}
                          >
                            Web
                          </Button>
                        )}
                        {generatedContent.social && (
                          <>
                            <Button
                              variant={previewTab === 'x' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setPreviewTab('x')}
                            >
                              X
                            </Button>
                            <Button
                              variant={previewTab === 'linkedin' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setPreviewTab('linkedin')}
                            >
                              LinkedIn
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 min-h-[200px]">
                      {previewTab === 'app' && (
                        <div className="space-y-2">
                          <p className="font-medium">{aiTitle}</p>
                          <p className="text-sm text-muted-foreground">{aiDescription}</p>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-sm whitespace-pre-wrap">{generatedContent.contentLong}</p>
                          </div>
                        </div>
                      )}
                      {previewTab === 'web' && generatedContent.web && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{generatedContent.web.excerpt}</p>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-sm whitespace-pre-wrap">{generatedContent.web.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedContent.web!.content, 'Contingut web')}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      )}
                      {previewTab === 'x' && generatedContent.social && (
                        <div className="space-y-2">
                          <p className="text-sm whitespace-pre-wrap">{generatedContent.social.xText}</p>
                          <p className="text-xs text-muted-foreground">{generatedContent.social.xText.length}/280 chars</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedContent.social!.xText, 'Text X')}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      )}
                      {previewTab === 'linkedin' && generatedContent.social && (
                        <div className="space-y-2">
                          <p className="text-sm whitespace-pre-wrap">{generatedContent.social.linkedinText}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedContent.social!.linkedinText, 'Text LinkedIn')}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      )}
                      {/* Link web per social */}
                      {(previewTab === 'x' || previewTab === 'linkedin') && webEnabled && aiTitle && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Link web:</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                              {`https://summasocial.app/ca/novetats/${aiTitle.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(
                                `https://summasocial.app/ca/novetats/${aiTitle.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
                                'Link'
                              )}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prompt imatge */}
                    {generatedContent.image && (
                      <div className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium">Prompt imatge (per generar manualment)</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(generatedContent.image!.prompt, 'Prompt')}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{generatedContent.image.prompt}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Alt text:</span> {generatedContent.image.altText}
                        </p>
                      </div>
                    )}

                    {/* Anàlisi IA */}
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <p className="text-xs font-medium mb-2">Anàlisi IA</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Claredat:</span>{' '}
                          <span className="font-medium">{generatedContent.analysis.clarityScore}/10</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risc:</span>{' '}
                          <Badge variant={generatedContent.analysis.techRisk === 'low' ? 'secondary' : 'destructive'}>
                            {generatedContent.analysis.techRisk}
                          </Badge>
                        </div>
                        <div>
                          <Badge variant={generatedContent.analysis.recommendation === 'PUBLICAR' ? 'default' : 'outline'}>
                            {generatedContent.analysis.recommendation}
                          </Badge>
                        </div>
                      </div>
                      {generatedContent.analysis.notes && (
                        <p className="text-xs text-muted-foreground mt-2">{generatedContent.analysis.notes}</p>
                      )}
                    </div>

                    <Button
                      onClick={handlePublishAI}
                      disabled={isPublishingAI}
                      className="w-full"
                    >
                      {isPublishingAI ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Publicant...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Publicar novetat
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Omple els camps i genera contingut amb IA</p>
                    <p className="text-xs mt-1">El contingut generat apareixerà aquí per revisar</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog editar esborrany */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar esborrany</DialogTitle>
            <DialogDescription>
              Ajusta el títol i la descripció abans de publicar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                Títol <span className="text-xs text-muted-foreground">(màx 60 caràcters)</span>
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={60}
                placeholder="Títol curt i descriptiu"
              />
              <p className="text-xs text-muted-foreground text-right">{editTitle.length}/60</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">
                Descripció <span className="text-xs text-muted-foreground">(màx 140 caràcters)</span>
              </Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={140}
                placeholder="Descripció breu de la novetat"
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{editDescription.length}/140</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-link">
                Enllaç <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="edit-link"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="/dashboard/movimientos o URL completa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel·lar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
