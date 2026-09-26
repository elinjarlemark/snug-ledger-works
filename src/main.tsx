import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/workspace.css";
import { ThemeProvider } from "next-themes";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="accountpro-theme" disableTransitionOnChange>
    <App />
  </ThemeProvider>,
);
