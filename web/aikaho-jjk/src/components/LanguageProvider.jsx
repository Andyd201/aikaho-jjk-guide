import { useEffect, useState } from "react";
import { LanguageContext, detectLang, saveLang } from "../i18n.js";

function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  // <html lang> suit la langue affichée (lecteurs d'écran, traduction du navigateur)
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next) {
    saveLang(next);
    setLangState(next);
  }

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export default LanguageProvider;
