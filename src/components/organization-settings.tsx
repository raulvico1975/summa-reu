'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Building2, Save, Upload, Loader2, Image as ImageIcon, PenTool, Trash2 } from 'lucide-react';
import type { Organization } from '@/lib/data';
import { useTranslations } from '@/i18n';
import { useSearchParams, useRouter } from 'next/navigation';
import { SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE } from '@/lib/returns/build-return-email-draft';

export function OrganizationSettings() {
  const { firestore, storage } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const { buildUrl } = useOrgUrl();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Detectar si venim de l'onboarding
  const isOnboarding = searchParams.get('onboarding') === '1';
  const returnUrl = searchParams.get('return') || buildUrl('/dashboard');

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingSignature, setUploadingSignature] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    taxId: '',
    address: '',
    city: '',
    province: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: '',
    signatureUrl: '',
    signatoryName: '',
    signatoryRole: '',
    contactAlertThreshold: 50,
    language: 'es' as 'ca' | 'es',
    returnEmailTemplate: '',
  });

  // Carregar dades de l'organització
  React.useEffect(() => {
    if (!organizationId || !firestore) return;

    // Flag per evitar setState després d'unmount
    let isMounted = true;

    const loadOrganization = async () => {
      try {
        const orgRef = doc(firestore, 'organizations', organizationId);
        const orgSnap = await getDoc(orgRef);

        if (!isMounted) return;

        if (orgSnap.exists()) {
          const data = orgSnap.data() as Organization;
          setFormData({
            name: data.name || '',
            taxId: data.taxId || '',
            address: data.address || '',
            city: data.city || '',
            province: data.province || '',
            zipCode: data.zipCode || '',
            phone: data.phone || '',
            email: data.email || '',
            website: data.website || '',
            logoUrl: data.logoUrl || '',
            signatureUrl: data.signatureUrl || '',
            signatoryName: data.signatoryName || '',
            signatoryRole: data.signatoryRole || '',
            contactAlertThreshold: data.contactAlertThreshold ?? 50,
            language: data.language ?? 'es',
            returnEmailTemplate: data.returnEmailTemplate || '',
          });
        }
      } catch (error) {
        console.error('Error carregant organització:', error);
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: t.settings.organization.errorLoading,
            description: t.settings.organization.errorLoadingDescription,
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrganization();

    return () => {
      isMounted = false;
    };
  }, [organizationId, firestore, toast, t.settings.organization.errorLoading, t.settings.organization.errorLoadingDescription]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'contactAlertThreshold' ? parseInt(value, 10) : value
    }));
  };

  const handleSave = async () => {
    if (!organizationId || !firestore) return;

    setSaving(true);
    try {
      const orgRef = doc(firestore, 'organizations', organizationId);
      
      const dataToSave: Record<string, any> = {
        name: formData.name,
        taxId: formData.taxId,
        updatedAt: new Date().toISOString(),
        address: formData.address || null,
        city: formData.city || null,
        province: formData.province || null,
        zipCode: formData.zipCode || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        logoUrl: formData.logoUrl || null,
        signatureUrl: formData.signatureUrl || null,
        signatoryName: formData.signatoryName || null,
        signatoryRole: formData.signatoryRole || null,
        contactAlertThreshold: formData.contactAlertThreshold,
        language: formData.language,
        returnEmailTemplate: formData.returnEmailTemplate.trim() ? formData.returnEmailTemplate : null,
      };

      await updateDoc(orgRef, dataToSave);

      // Si estem en onboarding, marcar pas complet i redirigir
      if (isOnboarding) {
        // Verificar si orgSettings està complet (taxId + address + zipCode)
        const isOrgSettingsComplete = !!(formData.taxId && formData.address && formData.zipCode);

        if (isOrgSettingsComplete) {
          // Llegir estat actual del wizard
          const wizardState = (organization?.onboarding as any)?.wizard;
          const completedSteps = wizardState?.completedSteps || [];

          // Afegir 'orgSettings' a completedSteps si no hi és
          if (!completedSteps.includes('orgSettings')) {
            completedSteps.push('orgSettings');
          }

          // Actualitzar wizard state a Firestore
          await updateDoc(orgRef, {
            'onboarding.wizard.completedSteps': completedSteps,
            'onboarding.wizard.updatedAt': serverTimestamp(),
          });
        }

        // Redirigir al dashboard (el wizard s'obrirà automàticament)
        toast({
          title: t.settings.organization.saved,
          description: t.settings.organization.savedDescription,
        });
        router.push(returnUrl);
        return;
      }

      toast({
        title: t.settings.organization.saved,
        description: t.settings.organization.savedDescription,
      });
    } catch (error) {
      console.error('Error guardant:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.settings.organization.errorSaving,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId || !storage) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorInvalidImage });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorImageTooLarge });
      return;
    }

    setUploadingLogo(true);
    try {
      const logoRef = ref(storage, `organizations/${organizationId}/logo`);
      await uploadBytes(logoRef, file);
      const downloadUrl = await getDownloadURL(logoRef);

      setFormData(prev => ({ ...prev, logoUrl: downloadUrl }));

      toast({
        title: t.settings.organization.uploadLogo,
        description: t.settings.organization.logoUploadedSuccess,
      });
    } catch (error) {
      console.error('Error pujant logo:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorUploadingLogo });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId || !storage) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorInvalidImage });
      return;
    }

    if (file.size > 1 * 1024 * 1024) { // 1MB
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorImageTooLarge });
      return;
    }

    setUploadingSignature(true);
    try {
      const signatureRef = ref(storage, `organizations/${organizationId}/signature`);
      await uploadBytes(signatureRef, file);
      const downloadUrl = await getDownloadURL(signatureRef);

      setFormData(prev => ({ ...prev, signatureUrl: downloadUrl }));

      toast({
        title: t.settings.organization.signatureUploaded,
        description: t.settings.organization.signatureUploadedSuccess,
      });
    } catch (error) {
      console.error('Error pujant firma:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.settings.organization.errorUploadingSignature });
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleRemoveSignature = () => {
    setFormData(prev => ({ ...prev, signatureUrl: '' }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t.settings.organization.title}
        </CardTitle>
        <CardDescription>
          {t.settings.organization.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>{t.settings.organization.logo}</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
              {formData.logoUrl ? (
                <img 
                  src={formData.logoUrl} 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={uploadingLogo}
                onClick={() => document.getElementById('logo-input')?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {t.settings.organization.uploadLogo}
              </Button>
              <input
                id="logo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-xs text-muted-foreground">{t.settings.organization.logoHint}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t.settings.organization.name}<span className="ml-1 text-muted-foreground">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t.settings.organization.namePlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">{t.settings.organization.taxId}<span className="ml-1 text-muted-foreground">*</span></Label>
            <Input
              id="taxId"
              value={formData.taxId}
              onChange={(e) => handleChange('taxId', e.target.value.toUpperCase())}
              placeholder={tr('settings.organization.placeholders.taxId')}
            />
            <p className="text-xs text-muted-foreground">
              {t.form.taxIdHelp}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">{t.settings.organization.address}</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder={tr('settings.organization.placeholders.address')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="zipCode">{t.settings.organization.zipCode}</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) => handleChange('zipCode', e.target.value)}
              placeholder={tr('settings.organization.placeholders.zipCode')}
              maxLength={5}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t.settings.organization.city}</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder={tr('settings.organization.placeholders.city')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">{t.settings.organization.province}</Label>
            <Input
              id="province"
              value={formData.province}
              onChange={(e) => handleChange('province', e.target.value)}
              placeholder={tr('settings.organization.placeholders.province')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">{t.settings.organization.phone}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder={tr('settings.organization.placeholders.phone')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.settings.organization.email}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder={tr('settings.organization.placeholders.email')}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">{t.settings.organization.website}</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder={tr('settings.organization.placeholders.website')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactAlertThreshold">{t.settings.organization.contactAlertThreshold}</Label>
          <Select
            value={formData.contactAlertThreshold.toString()}
            onValueChange={(value) => handleChange('contactAlertThreshold', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t.settings.organization.allMovements} (0 €)</SelectItem>
              <SelectItem value="50">50 €</SelectItem>
              <SelectItem value="100">100 €</SelectItem>
              <SelectItem value="500">500 €</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t.settings.organization.contactAlertThresholdDescription}</p>
        </div>

        {/* Secció Certificats */}
        <div className="pt-4 border-t">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            {t.settings.organization.certificatesSection}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t.settings.organization.certificatesSectionDescription}
          </p>

          {/* Idioma dels certificats */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="language">{t.settings.organization.certificateLanguage}</Label>
            <Select
              value={formData.language}
              onValueChange={(value: 'ca' | 'es') => handleChange('language', value)}
            >
            <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t.settings.spanish}</SelectItem>
                <SelectItem value="ca">{t.settings.catalan}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.settings.organization.certificateLanguageDescription}</p>
          </div>

          {/* Firma digitalitzada */}
          <div className="space-y-3 mb-4">
            <Label>{t.settings.organization.signature}</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                {formData.signatureUrl ? (
                  <img
                    src={formData.signatureUrl}
                    alt="Firma"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <PenTool className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingSignature}
                    onClick={() => document.getElementById('signature-input')?.click()}
                  >
                    {uploadingSignature ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {t.settings.organization.uploadSignature}
                  </Button>
                  {formData.signatureUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveSignature}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <input
                  id="signature-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSignatureUpload}
                />
                <p className="text-xs text-muted-foreground">{t.settings.organization.signatureHint}</p>
              </div>
            </div>
          </div>

          {/* Nom i càrrec del signant */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signatoryName">{t.settings.organization.signatoryName}</Label>
              <Input
                id="signatoryName"
                value={formData.signatoryName}
                onChange={(e) => handleChange('signatoryName', e.target.value)}
                placeholder={t.settings.organization.signatoryNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatoryRole">{t.settings.organization.signatoryRole}</Label>
              <Input
                id="signatoryRole"
                value={formData.signatoryRole}
                onChange={(e) => handleChange('signatoryRole', e.target.value)}
                placeholder={t.settings.organization.signatoryRolePlaceholder}
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t space-y-3">
          <h3 className="text-base font-semibold">{tr('settings.returnEmailTemplate.title')}</h3>
          <p className="text-sm text-muted-foreground">{tr('settings.returnEmailTemplate.description')}</p>
          <Textarea
            id="returnEmailTemplate"
            value={formData.returnEmailTemplate}
            onChange={(e) => handleChange('returnEmailTemplate', e.target.value)}
            className="min-h-40"
          />
          <p className="text-xs text-muted-foreground">{tr('settings.returnEmailTemplate.variables')}</p>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleChange('returnEmailTemplate', SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE[formData.language] ?? SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE.es)}
            >
              {tr('settings.returnEmailTemplate.restore')}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t.common.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
