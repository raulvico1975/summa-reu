'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Upload,
  Languages,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileJson,
  Loader2,
  Cloud,
  HardDrive,
  Send,
  Database,
  XCircle,
  RefreshCw,
  BookOpen,
  Compass,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { getStorage, ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Import JSON locals directament
import caJson from '@/i18n/locales/ca.json';
import esJson from '@/i18n/locales/es.json';
import frJson from '@/i18n/locales/fr.json';
import ptJson from '@/i18n/locales/pt.json';

type Language = 'ca' | 'es' | 'fr' | 'pt';

type JsonMessages = Record<string, string>;

type DownloadSource = 'storage' | 'local' | null;

const localBundles: Record<Language, JsonMessages> = {
  ca: caJson as JsonMessages,
  es: esJson as JsonMessages,
  fr: frJson as JsonMessages,
  pt: ptJson as JsonMessages,
};

const languageLabels: Record<Language, string> = {
  ca: 'Català',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
};

type UploadValidation = {
  isValid: boolean;
  totalKeys: number;
  missingKeys: string[];
  extraKeys: string[];
  invalidValues: string[];
  parseError?: string;
};

type StorageStatus = 'checking' | 'ok' | 'missing' | 'unauthorized' | 'error';

type LanguageStorageStatus = Record<Language, StorageStatus>;

const ALL_LANGUAGES: Language[] = ['ca', 'es', 'fr', 'pt'];

export function I18nManager() {
  const { t } = useTranslations();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = React.useState<Language>('ca');
  const [uploadValidation, setUploadValidation] = React.useState<UploadValidation | null>(null);
  const [uploadedContent, setUploadedContent] = React.useState<JsonMessages | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadSource, setDownloadSource] = React.useState<DownloadSource>(null);
  const [currentVersion, setCurrentVersion] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Storage initialization state
  const [storageStatus, setStorageStatus] = React.useState<LanguageStorageStatus>({
    ca: 'checking',
    es: 'checking',
    fr: 'checking',
    pt: 'checking',
  });
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [initProgress, setInitProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [initResult, setInitResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // Estadístiques del bundle actual
  const currentBundle = localBundles[selectedLanguage];
  const baseBundle = localBundles.ca; // ca és la referència
  const totalKeysInBase = Object.keys(baseBundle).length;
  const totalKeysInCurrent = Object.keys(currentBundle).length;

  // Carregar versió actual al mount
  React.useEffect(() => {
    const loadVersion = async () => {
      try {
        const firestore = getFirestore();
        const i18nDoc = await getDoc(doc(firestore, 'system', 'i18n'));
        if (i18nDoc.exists()) {
          setCurrentVersion(i18nDoc.data()?.version ?? 0);
        } else {
          setCurrentVersion(0);
        }
      } catch {
        setCurrentVersion(0);
      }
    };
    loadVersion();
  }, []);

  // Comprovar estat de Storage per cada idioma
  const checkStorageStatus = React.useCallback(async () => {
    const storage = getStorage();
    const newStatus: LanguageStorageStatus = { ca: 'checking', es: 'checking', fr: 'checking', pt: 'checking' };
    setStorageStatus(newStatus);

    for (const lang of ALL_LANGUAGES) {
      try {
        const fileRef = ref(storage, `i18n/${lang}.json`);
        await getDownloadURL(fileRef);
        newStatus[lang] = 'ok';
      } catch (error: unknown) {
        const firebaseError = error as { code?: string };
        if (firebaseError.code === 'storage/object-not-found') {
          newStatus[lang] = 'missing';
        } else if (firebaseError.code === 'storage/unauthorized') {
          newStatus[lang] = 'unauthorized';
        } else {
          newStatus[lang] = 'error';
        }
      }
      setStorageStatus({ ...newStatus });
    }
  }, []);

  // Comprovar estat al mount
  React.useEffect(() => {
    checkStorageStatus();
  }, [checkStorageStatus]);

  // Inicialitzar Storage amb els fitxers locals
  const handleInitializeStorage = async () => {
    setIsInitializing(true);
    setInitProgress({ current: 0, total: ALL_LANGUAGES.length });
    setInitResult(null);

    const storage = getStorage();
    let failedLang: string | null = null;

    try {
      for (let i = 0; i < ALL_LANGUAGES.length; i++) {
        const lang = ALL_LANGUAGES[i];
        setInitProgress({ current: i + 1, total: ALL_LANGUAGES.length });

        const bundle = localBundles[lang];
        const jsonString = JSON.stringify(bundle, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const fileRef = ref(storage, `i18n/${lang}.json`);

        await uploadBytes(fileRef, blob);
      }

      // Publicar (incrementar versió)
      const firestore = getFirestore();
      const i18nDocRef = doc(firestore, 'system', 'i18n');
      const currentDoc = await getDoc(i18nDocRef);
      const currentVer = currentDoc.exists() ? (currentDoc.data()?.version ?? 0) : 0;
      const newVersion = currentVer + 1;

      await setDoc(i18nDocRef, {
        version: newVersion,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setCurrentVersion(newVersion);
      setInitResult({ success: true, message: 'Fet ✅ Els 4 idiomes són a Storage.' });

      toast({
        title: 'Storage inicialitzat',
        description: `Els 4 idiomes s'han pujat i activat (v${newVersion}).`,
      });
    } catch (error) {
      console.error('[i18n] Initialize error:', error);
      failedLang = ALL_LANGUAGES[initProgress?.current ? initProgress.current - 1 : 0];
      setInitResult({ success: false, message: `Error ❌ No s'ha pogut pujar: ${failedLang}` });

      toast({
        variant: 'destructive',
        title: 'Error inicialitzant',
        description: `No s'ha pogut pujar ${failedLang}. Verifica els permisos.`,
      });
    } finally {
      setIsInitializing(false);
      setInitProgress(null);
      // Refrescar estat
      checkStorageStatus();
    }
  };

  // Descarregar des de Storage (amb fallback a local)
  const handleDownloadFromStorage = async () => {
    setIsDownloading(true);
    setDownloadSource(null);

    try {
      const storage = getStorage();
      const fileRef = ref(storage, `i18n/${selectedLanguage}.json`);
      const url = await getDownloadURL(fileRef);

      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');

      const data = await response.json();
      const jsonString = JSON.stringify(data, null, 2);
      downloadFile(jsonString, `${selectedLanguage}.json`);
      setDownloadSource('storage');

      toast({
        title: 'JSON descarregat (Storage)',
        description: `${selectedLanguage}.json (${Object.keys(data).length} claus)`,
      });
    } catch {
      // Fallback a local
      const bundle = localBundles[selectedLanguage];
      const jsonString = JSON.stringify(bundle, null, 2);
      downloadFile(jsonString, `${selectedLanguage}.json`);
      setDownloadSource('local');

      toast({
        title: 'JSON descarregat (Local)',
        description: `${selectedLanguage}.json (${totalKeysInCurrent} claus) - No hi ha versió a Storage`,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper per descarregar fitxer
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Pujar a Storage
  const handleUploadToStorage = async () => {
    if (!uploadedContent) return;

    setIsUploading(true);
    try {
      const storage = getStorage();
      const fileRef = ref(storage, `i18n/${selectedLanguage}.json`);
      const jsonString = JSON.stringify(uploadedContent, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      await uploadBytes(fileRef, blob);

      toast({
        title: 'JSON pujat a Storage',
        description: `${selectedLanguage}.json (${Object.keys(uploadedContent).length} claus). Recorda publicar per activar els canvis.`,
      });

      // Clear upload state
      handleClearUpload();
    } catch (error) {
      console.error('[i18n] Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Error pujant',
        description: 'No s\'ha pogut pujar el fitxer. Verifica els permisos.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Publicar: incrementar version per invalidar cache
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const firestore = getFirestore();
      const i18nDocRef = doc(firestore, 'system', 'i18n');

      // Obtenir versió actual
      const currentDoc = await getDoc(i18nDocRef);
      const currentVer = currentDoc.exists() ? (currentDoc.data()?.version ?? 0) : 0;
      const newVersion = currentVer + 1;

      // Actualitzar amb nova versió
      await setDoc(i18nDocRef, {
        version: newVersion,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setCurrentVersion(newVersion);

      toast({
        title: 'Traduccions publicades',
        description: `Versió ${newVersion} activa. Tots els usuaris veuran els canvis.`,
      });
    } catch (error) {
      console.error('[i18n] Publish error:', error);
      toast({
        variant: 'destructive',
        title: 'Error publicant',
        description: 'No s\'ha pogut publicar. Verifica els permisos.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Validar JSON pujat
  const validateUpload = (content: unknown): UploadValidation => {
    // 1. Verificar que és un objecte
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return {
        isValid: false,
        totalKeys: 0,
        missingKeys: [],
        extraKeys: [],
        invalidValues: [],
        parseError: 'El fitxer no és un objecte JSON vàlid',
      };
    }

    const uploadedKeys = Object.keys(content);
    const baseKeys = new Set(Object.keys(baseBundle));
    const uploadedKeysSet = new Set(uploadedKeys);

    // 2. Verificar que tots els values són strings
    const invalidValues: string[] = [];
    for (const [key, value] of Object.entries(content)) {
      if (typeof value !== 'string') {
        invalidValues.push(`${key}: ${typeof value}`);
      }
    }

    // 3. Comparar amb base (ca)
    const missingKeys = [...baseKeys].filter(k => !uploadedKeysSet.has(k));
    const extraKeys = uploadedKeys.filter(k => !baseKeys.has(k));

    return {
      isValid: invalidValues.length === 0,
      totalKeys: uploadedKeys.length,
      missingKeys,
      extraKeys,
      invalidValues,
    };
  };

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadValidation(null);
    setUploadedContent(null);

    try {
      const text = await file.text();
      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        setUploadValidation({
          isValid: false,
          totalKeys: 0,
          missingKeys: [],
          extraKeys: [],
          invalidValues: [],
          parseError: 'Error parsejant JSON. Verifica el format.',
        });
        return;
      }

      const validation = validateUpload(parsed);
      setUploadValidation(validation);

      if (validation.isValid) {
        setUploadedContent(parsed as JsonMessages);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No s\'ha pogut llegir el fitxer',
      });
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Clear upload state
  const handleClearUpload = () => {
    setUploadValidation(null);
    setUploadedContent(null);
  };

  return (
    <div className="space-y-4">
      {/* Header amb selector - stacked on mobile */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Languages className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-semibold">Traduccions</h3>
            <p className="text-sm text-muted-foreground">
              Revisa, puja i publica textos per idioma
            </p>
          </div>
        </div>

        <Select
          value={selectedLanguage}
          onValueChange={(v) => {
            setSelectedLanguage(v as Language);
            handleClearUpload();
          }}
        >
          <SelectTrigger className="w-full md:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(localBundles) as Language[]).map((lang) => (
              <SelectItem key={lang} value={lang}>
                {languageLabels[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* A) Text introductori */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Com funciona aquesta secció</h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Aquesta secció permet gestionar les traduccions de l&apos;aplicació sense tocar codi.
            Els canvis no afecten els usuaris fins que es publiquen explícitament.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Download Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-green-500" />
              1. Descarregar JSON
            </CardTitle>
            <CardDescription>
              Baixa el paquet de traducció (Storage prioritari, fallback local)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Micro-guia */}
            <div className="text-xs space-y-1 p-2 rounded bg-muted/50 border-l-2 border-green-500">
              <div><strong>Quan usar-ho:</strong> Abans de traduir o revisar textos. Aquest fitxer és la base actual amb totes les claus.</div>
              <div><strong>Què fa:</strong> Descarrega l&apos;estat vigent de les traduccions.</div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{selectedLanguage}.json</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{totalKeysInCurrent} claus</Badge>
                {downloadSource && (
                  <Badge variant={downloadSource === 'storage' ? 'default' : 'outline'} className="gap-1">
                    {downloadSource === 'storage' ? (
                      <><Cloud className="h-3 w-3" /> Storage</>
                    ) : (
                      <><HardDrive className="h-3 w-3" /> Local</>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            {selectedLanguage !== 'ca' && totalKeysInCurrent !== totalKeysInBase && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Diferència amb base (ca): {totalKeysInBase - totalKeysInCurrent} claus
                </span>
              </div>
            )}

            <Button onClick={handleDownloadFromStorage} className="w-full" disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Descarregar {languageLabels[selectedLanguage]}
            </Button>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-blue-500" />
              2. Pujar JSON
            </CardTitle>
            <CardDescription>
              Puja un fitxer JSON traduït per validar-lo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Micro-guia */}
            <div className="text-xs space-y-1 p-2 rounded bg-muted/50 border-l-2 border-blue-500">
              <div><strong>Quan usar-ho:</strong> Quan tens un fitxer JSON traduït o corregit.</div>
              <div><strong>Què fa:</strong> Valida que el fitxer sigui coherent amb l&apos;idioma base (claus que falten o sobren). Encara no activa cap canvi als usuaris.</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              id="json-upload"
            />

            {!uploadValidation ? (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Clica per seleccionar fitxer .json
                    </span>
                  </div>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Parse error */}
                {uploadValidation.parseError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{uploadValidation.parseError}</span>
                  </div>
                )}

                {/* Validation results */}
                {!uploadValidation.parseError && (
                  <>
                    {/* Total keys */}
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Claus totals</span>
                      </div>
                      <Badge variant="secondary">{uploadValidation.totalKeys}</Badge>
                    </div>

                    {/* Missing keys */}
                    {uploadValidation.missingKeys.length > 0 && (
                      <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              Claus que falten
                            </span>
                          </div>
                          <Badge variant="outline" className="text-amber-600">
                            {uploadValidation.missingKeys.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          {uploadValidation.missingKeys.slice(0, 3).join(', ')}
                          {uploadValidation.missingKeys.length > 3 && '...'}
                        </p>
                      </div>
                    )}

                    {/* Extra keys */}
                    {uploadValidation.extraKeys.length > 0 && (
                      <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                              Claus extra
                            </span>
                          </div>
                          <Badge variant="outline" className="text-blue-600">
                            {uploadValidation.extraKeys.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          {uploadValidation.extraKeys.slice(0, 3).join(', ')}
                          {uploadValidation.extraKeys.length > 3 && '...'}
                        </p>
                      </div>
                    )}

                    {/* Invalid values */}
                    {uploadValidation.invalidValues.length > 0 && (
                      <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-400">
                              Valors invàlids (no string)
                            </span>
                          </div>
                          <Badge variant="destructive">
                            {uploadValidation.invalidValues.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          {uploadValidation.invalidValues.slice(0, 3).join(', ')}
                        </p>
                      </div>
                    )}

                    {/* All good */}
                    {uploadValidation.isValid &&
                      uploadValidation.missingKeys.length === 0 &&
                      uploadValidation.extraKeys.length === 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">JSON vàlid i complet</span>
                        </div>
                      )}
                  </>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearUpload}
                    className="flex-1"
                  >
                    Netejar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!uploadValidation.isValid || isUploading}
                    className="flex-1"
                    onClick={handleUploadToStorage}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Pujar a Storage
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Storage Initialization Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-orange-500" />
            3. Inicialització (casos especials)
          </CardTitle>
          <CardDescription>
            Això puja a Storage els fitxers de traducció (ca/es/fr/pt) que tens al projecte i els activa per tothom.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Micro-guia amb avís */}
          <div className="text-xs space-y-2 p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Només necessari en casos especials
            </div>
            <div className="text-amber-700 dark:text-amber-300">
              Usa aquest botó només si:
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>és la primera vegada que es configuren traduccions, o</li>
                <li>s&apos;ha esborrat el Storage de traduccions.</li>
              </ul>
            </div>
            <div className="text-amber-600 dark:text-amber-400 font-medium">
              Si només estàs corregint textos, no cal inicialitzar.
            </div>
          </div>

          {/* Status per idioma */}
          <div className="grid grid-cols-4 gap-2">
            {ALL_LANGUAGES.map((lang) => {
              const status = storageStatus[lang];
              return (
                <div
                  key={lang}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-muted/30"
                >
                  <span className="text-sm font-medium">{languageLabels[lang]}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Cloud className="h-3 w-3 text-muted-foreground" />
                      {status === 'checking' && (
                        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                      )}
                      {status === 'ok' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {status === 'missing' && (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {status === 'unauthorized' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {status === 'error' && (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {status === 'checking' && 'Comprovant...'}
                    {status === 'ok' && 'Storage OK'}
                    {status === 'missing' && 'Falta a Storage'}
                    {status === 'unauthorized' && 'Sense permís'}
                    {status === 'error' && 'Error'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Botó refrescar */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={checkStorageStatus}
              disabled={isInitializing}
              className="gap-1 text-muted-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refrescar estat
            </Button>

            {/* Progress o resultat */}
            {isInitializing && initProgress && (
              <span className="text-sm text-muted-foreground">
                Pujant... ({initProgress.current}/{initProgress.total})
              </span>
            )}
            {!isInitializing && initResult && (
              <span className={`text-sm ${initResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {initResult.message}
              </span>
            )}
          </div>

          {/* Botó principal amb confirmació */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full gap-2"
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Inicialitzar Storage
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.admin.i18n.initializeStorageTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.admin.i18n.initializeStorageDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={handleInitializeStorage}>
                  {t.admin.i18n.initializeConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Publish Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-purple-500" />
            4. Publicar traduccions
          </CardTitle>
          <CardDescription>
            Activa els canvis pujats a Storage per a tots els usuaris
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Micro-guia */}
          <div className="text-xs space-y-2 p-3 rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 font-medium text-purple-800 dark:text-purple-200">
              <Send className="h-4 w-4" />
              Aquest pas activa els canvis per a tothom
            </div>
            <div className="text-purple-700 dark:text-purple-300">
              Publicar incrementa la versió i invalida la cache dels usuaris.
              Els canvis es veuran immediatament, sense recarregar la pàgina.
            </div>
            <div className="text-purple-600 dark:text-purple-400">
              <strong>Quan usar-ho:</strong> Només quan estiguis segur que les traduccions són correctes.
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Versió activa:</span>
              <Badge variant="outline" className="font-mono">
                v{currentVersion ?? '...'}
              </Badge>
            </div>
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="gap-2"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publicar (v{(currentVersion ?? 0) + 1})
            </Button>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Publicar incrementa la versió i invalida el cache de tots els usuaris.
              Els canvis es veuran immediatament sense recarregar la pàgina.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* C) Resum final - Ordre habitual */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Compass className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-2">
          <h4 className="font-medium">Ordre habitual</h4>
          <div className="font-mono text-sm bg-background px-3 py-2 rounded border">
            Descarregar → Editar fora → Pujar → (Inicialitzar si cal) → Publicar
          </div>
          <p className="text-xs text-muted-foreground">
            La majoria de vegades només necessites: Descarregar → Editar → Pujar → Publicar
          </p>
        </div>
      </div>

      {/* Info footer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Referència:</strong> El català (ca) és l&apos;idioma base. Les traduccions es comparen
          amb les {totalKeysInBase} claus del català per detectar diferències.
        </div>
      </div>
    </div>
  );
}
