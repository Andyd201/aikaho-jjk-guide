import { Routes, Route } from "react-router";
import HomePage from "./pages/HomePage.jsx";
import SetPage from "./pages/SetPage.jsx";
import CardPage from "./pages/CardPage.jsx";
import LegacyCardRedirect from "./pages/LegacyCardRedirect.jsx";
import { SITE_NAME } from "./config.js";
import "./App.css";

function App() {
  return (
    <Routes>
      {/* / redirige aussi les anciens liens filtrés (/?rarity=ACE) vers JJK-01 */}
      <Route path="/" element={<HomePage />} />
      <Route path="/sets/:code" element={<SetPage />} />
      <Route path="/sets/:code/cards/:id" element={<CardPage />} />
      {/* Ancienne URL d'une fiche, d'avant le multi-set */}
      <Route path="/cards/:id" element={<LegacyCardRedirect />} />
      <Route
        path="*"
        element={
          <>
            <title>{`Page not found – ${SITE_NAME}`}</title>
            <meta name="robots" content="noindex" />
            <p>Page introuvable.</p>
          </>
        }
      />
    </Routes>
  );
}

export default App;
