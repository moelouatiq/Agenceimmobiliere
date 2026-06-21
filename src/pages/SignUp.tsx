
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useSignupsAllowed } from "@/hooks/useSignupsAllowed";

// Add Zod schema for validation
const signUpSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Format d'email invalide"),
  password: z.string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});

// Fix for TypeScript errors in WeeklyOverview.tsx
const fixReservationsTypeErrors = () => {
  // This function exists solely to note that we need to fix type errors in WeeklyOverview.tsx
  // The actual fixes will be in another file
};

const SignUp = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string }>({});
  const { signUp, isLoading } = useAuth();
  const { signupsAllowed, isLoading: isCheckingSignups } = useSignupsAllowed();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    if (!signupsAllowed) {
      return; // Don't proceed if signups are not allowed
    }

    try {
      // Validate input using Zod
      signUpSchema.parse({ firstName, lastName, email, password });

      if (password !== confirmPassword) {
        setValidationErrors(prev => ({
          ...prev,
          password: "Les mots de passe ne correspondent pas"
        }));
        return;
      }

      // Pass the full name to signUp
      const fullName = `${firstName} ${lastName}`.trim();
      await signUp(email, password, fullName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.flatten().fieldErrors;
        setValidationErrors({
          firstName: errors.firstName?.[0],
          lastName: errors.lastName?.[0],
          email: errors.email?.[0],
          password: errors.password?.[0]
        });
      }
    }
  };

  // Show loading state while checking if signups are allowed
  if (isCheckingSignups) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-progest-primary/10 to-progest-secondary/10 p-4">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-progest-primary"></div>
        </div>
      </div>
    );
  }

  // If signups are not allowed, show message and redirect button
  if (signupsAllowed === false) {
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
                Inscription désactivée
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-4">Les inscriptions sont actuellement désactivées par l'administrateur.</p>
              <p>Veuillez contacter votre administrateur système pour créer un compte.</p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Link to="/signin" className="w-full">
                <Button variant="default" className="w-full bg-progest-primary hover:bg-progest-secondary transition-colors duration-200">
                  Retour à la connexion
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // If signups are allowed, show the signup form
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
              Créez votre compte
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className={`border-progest-primary/20 focus-visible:ring-progest-primary ${validationErrors.firstName ? "border-destructive" : ""}`}
                  />
                  {validationErrors.firstName && (
                    <p className="text-destructive text-sm mt-1">{validationErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className={`border-progest-primary/20 focus-visible:ring-progest-primary ${validationErrors.lastName ? "border-destructive" : ""}`}
                  />
                  {validationErrors.lastName && (
                    <p className="text-destructive text-sm mt-1">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`border-progest-primary/20 focus-visible:ring-progest-primary ${validationErrors.email ? "border-destructive" : ""}`}
                />
                {validationErrors.email && (
                  <p className="text-destructive text-sm mt-1">{validationErrors.email}</p>
                )}
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
                    minLength={6}
                    className={`pr-10 border-progest-primary/20 focus-visible:ring-progest-primary ${validationErrors.password ? "border-destructive" : ""}`}
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
                {validationErrors.password && (
                  <p className="text-destructive text-sm mt-1">{validationErrors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10 border-progest-primary/20 focus-visible:ring-progest-primary"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
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
                    <span>Inscription...</span>
                  </div>
                ) : (
                  "S'inscrire"
                )}
              </Button>
              <p className="text-center text-sm text-gray-600">
                Déjà un compte ?{" "}
                <Link to="/signin" className="text-progest-primary hover:underline font-medium">
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;
