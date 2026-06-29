import { useState } from "react";
import { Link } from "react-router-dom";
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

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSubmitted(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
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
              Mot de passe oublié
            </CardTitle>
            <CardDescription className="text-center">
              Entrez votre adresse email pour recevoir un lien de réinitialisation
            </CardDescription>
          </CardHeader>

          {submitted ? (
            <CardContent>
              <div className="rounded-md bg-green-50 border border-green-200 p-4 text-center text-sm text-green-800">
                Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="exemple@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-progest-primary/20 focus-visible:ring-progest-primary"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full bg-progest-primary hover:bg-progest-secondary transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      <span>Envoi en cours...</span>
                    </div>
                  ) : (
                    "Envoyer le lien de réinitialisation"
                  )}
                </Button>
              </CardFooter>
            </form>
          )}

          <CardFooter className="justify-center pb-6 pt-0">
            <Link to="/signin" className="text-sm text-progest-primary hover:underline font-medium">
              ← Retour à la connexion
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
