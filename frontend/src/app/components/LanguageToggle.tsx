import { Globe } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import { Button } from "./ui/Button";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "en" ? "es" : "en")}
      className="gap-2"
    >
      <Globe className="w-4 h-4" />
      <span>{language === "en" ? "ES" : "EN"}</span>
    </Button>
  );
}
