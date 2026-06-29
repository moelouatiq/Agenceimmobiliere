
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useSignupsAllowed } from "@/hooks/useSignupsAllowed";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, isLoading } = useAuth();
  const { signupsAllowed, isLoading: isCheckingSignups } = useSignupsAllowed();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email, password);
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
            <CardTitle className="text-2xl font-bold text-center text-progest-primary">Système de Gestion Immobilière</CardTitle>
            <CardDescription className="text-center">
              Connectez-vous pour accéder à votre compte
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
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
                    <span>Connexion...</span>
                  </div>
                ) : (
                  "Se connecter"
                )}
              </Button>
              <p className="text-center text-sm">
                <Link to="/forgot-password" className="text-progest-primary hover:underline font-medium">
                  Mot de passe oublié ?
                </Link>
              </p>
              {(!isCheckingSignups && signupsAllowed === true) && (
                <p className="text-center text-sm text-gray-600">
                  Pas encore de compte ?{" "}
                  <Link to="/signup" className="text-progest-primary hover:underline font-medium">
                    S'inscrire
                  </Link>
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SignIn;
