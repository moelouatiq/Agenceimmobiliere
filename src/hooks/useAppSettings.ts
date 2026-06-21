
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface AppSettings {
  id?: number;
  allow_signups: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching app settings:', error);
        // If no settings exist, we'll create a default one
        if (error.code === 'PGRST116') {
          const defaultSettings: Omit<AppSettings, 'id' | 'created_at' | 'updated_at'> = {
            allow_signups: true,
          };
          
          const { data: newData, error: createError } = await supabase
            .from('app_settings')
            .insert(defaultSettings)
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating default settings:', createError);
          } else {
            setSettings(newData);
          }
        }
      } else {
        setSettings(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      if (!settings?.id) {
        throw new Error('No settings found to update');
      }

      const { error } = await supabase
        .from('app_settings')
        .update({
          ...newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) {
        throw error;
      }

      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      
      toast({
        title: 'Paramètres mis à jour',
        description: 'Les paramètres de l\'application ont été mis à jour avec succès.',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Une erreur est survenue: ${error.message || error}`,
      });
      
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const toggleSignups = async (enabled: boolean) => {
    return await updateSettings({ allow_signups: enabled });
  };

  // Ensure this value is correctly derived from settings
  const signupsAllowed = settings?.allow_signups ?? false;

  return {
    settings,
    isLoading,
    fetchSettings,
    updateSettings,
    toggleSignups,
    signupsAllowed,
    allowSignups: settings?.allow_signups ?? false, // Keep for backward compatibility
  };
}

export default useAppSettings;
