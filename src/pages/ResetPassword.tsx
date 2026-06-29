import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Listen for Supabase PASSWORD_RECOVERY event (fires when user clicks the email link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsReady(true);
        setIsInitializing(false);
      }
    });

    // Fallback: check if a session already exists (e.g. navigating back to this page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsReady(true);
      }
      // Delay ending init to let PASSWORD_RECOVERY event fire if it hasn't yet
      setTimeout(() => setIsInitializing(false), 800);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au minimum 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate("/signin"), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isInitializing) {
      return (
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-progest-primary"></div>
        </CardContent>
      );
    }

    if (success) {
      return (
        <CardContent>
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-center text-sm text-green-800">
            Mot de passe mis à jour avec succès ! Redirection vers la connexion...
          </div>
        </CardContent>
      );
    }

    if (!isReady) {
      return (
        <CardContent>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-center text-sm text-yellow-800">
            Lien de réinitialisation invalide ou expiré. Veuillez faire une nouvelle demande depuis la page de connexion.
          </div>
        </CardContent>
      );
    }

    return (
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10 border-progest-primary/20 focus-visible:ring-progest-primary"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Minimum 8 caractères</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pr-10 border-progest-primary/20 focus-visible:ring-progest-primary"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-progest-primary hover:bg-progest-secondary transition-colors duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                <span>Mise à jour...</span>
              </div>
            ) : (
              "Mettre à jour le mot de passe"
            )}
          </Button>
        </CardFooter>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-progest-primary/10 to-progest-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png"
            alt="SUD HOWS DISTRIBUTION Logo"
            className="h-20 w-auto mb-2"
          />
          <h1 className="text-3xl font-bold text-progest-primary">SUD HOWS DISTRIBUTION</h1>
        </div>

        <Card className="w-full border-progest-primary/20 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-progest-primary">
              Nouveau mot de passe
            </CardTitle>
            <CardDescription className="text-center">
              Choisissez un nouveau mot de passe sécurisé
            </CardDescription>
          </CardHeader>

          {renderContent()}

          {!success && (
            <CardFooter className="justify-center pb-6 pt-0">
              <Link to="/signin" className="text-sm text-progest-primary hover:underline font-medium">
                ← Retour à la connexion
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
