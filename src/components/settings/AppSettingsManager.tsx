
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import useAppSettings from '@/hooks/useAppSettings';
import { useSignupsAllowed } from '@/hooks/useSignupsAllowed';

export default function AppSettingsManager() {
  const { settings, isLoading, toggleSignups } = useAppSettings();
  const { signupsAllowed, isLoading: isCheckingSignups } = useSignupsAllowed();

  const handleToggleSignups = async (checked: boolean) => {
    console.log('Toggling signups to:', checked);
    await toggleSignups(checked);
  };

  if (isLoading || isCheckingSignups) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paramètres de l'application</CardTitle>
          <CardDescription>Gérez les paramètres globaux de l'application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-progest-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de l'application</CardTitle>
        <CardDescription>Gérez les paramètres globaux de l'application</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-signups" className="text-base">Autoriser les inscriptions</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Activer ou désactiver la possibilité pour de nouveaux utilisateurs de s'inscrire
              </p>
            </div>
            <Switch
              id="allow-signups"
              checked={signupsAllowed === true}
              onCheckedChange={handleToggleSignups}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
