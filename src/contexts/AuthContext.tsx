import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSignupsAllowed } from "@/hooks/useSignupsAllowed";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the available pages for access control based on the sidebar navigation
const availablePages = [
  '/',  // Dashboard
  '/proprietes', 
  '/proprietaires', 
  '/reservations', 
  '/clients', 
  '/depenses',
  '/parametres'
];

// Map pages to table names for user_table_access
const pageToTableMapping: Record<string, string> = {
  '/': 'dashboard',
  '/proprietes': 'proprietes',
  '/proprietaires': 'proprietaires',
  '/reservations': 'reservations',
  '/clients': 'clients',
  '/depenses': 'depenses',
  '/parametres': 'parametres'
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signupsAllowed } = useSignupsAllowed();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Function to create a user role entry
  const createUserRole = async (userId: string, fullName: string, role: 'admin' | 'user' = 'admin') => {
    try {
      // Insert into user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          name: fullName,
          role: role,
        });

      if (roleError) throw roleError;

      // If user is admin, grant access to all pages
      if (role === 'admin') {
        const accessEntries = availablePages.map(page => ({
          user_id: userId,
          page_path: page,
          table_name: pageToTableMapping[page] || page.substring(1),
          can_access: true
        }));

        // Insert into user_table_access table
        const { error: accessError } = await supabase
          .from('user_table_access')
          .insert(accessEntries);

        if (accessError) throw accessError;
      }

      return true;
    } catch (error: any) {
      console.error('Error creating user role:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true);

      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // If user was created successfully
      if (data.user) {
        try {
          // Create user role and permissions
          await createUserRole(data.user.id, fullName);
          
          toast({
            title: "Inscription réussie",
            description: "Votre compte a été créé avec succès. Veuillez vous connecter.",
            variant: "default"
          });
          navigate("/signin");
        } catch (roleError: any) {
          toast({
            variant: "destructive",
            title: "Erreur d'attribution de rôle",
            description: roleError.message || "Une erreur est survenue lors de la configuration du compte",
          });
        }
      } else {
        // Email confirmation is required
        toast({
          title: "Vérification requise",
          description: "Un email de confirmation a été envoyé. Veuillez vérifier votre boîte de réception.",
          variant: "default"
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue lors de l'inscription",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast({
            variant: "destructive",
            title: "Confirmation requise",
            description: "Veuillez vérifier votre email et confirmer votre compte.",
          });
        } else {
          throw error;
        }
      } else if (data.user) {
        navigate("/");
        toast({
          title: "Connexion réussie",
          description: "Bienvenue dans votre espace ERP",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue lors de la connexion",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/signin");
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, signIn, signUp, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
