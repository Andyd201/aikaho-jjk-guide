import { Routes, Route } from "react-router";
import SetPage from "./pages/SetPage.jsx";
import CardPage from "./pages/CardPage.jsx";
import { SET_NAME } from "./config.js";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<SetPage />} />
      <Route path="/cards/:id" element={<CardPage />} />
      <Route
        path="*"
        element={
          <>
            <title>{`Page not found – ${SET_NAME}`}</title>
            <meta name="robots" content="noindex" />
            <p>Page introuvable.</p>
          </>
        }
      />
    </Routes>
  );
}

export default App;
