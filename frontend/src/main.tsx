import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { lazy, Suspense } from "react";
import "./theme.css";
import "./style.css";
import "./refinement.css";
import "./dining.css";

const PlatformApp = lazy(() => import("./PlatformApp"));
const MenuPreview = lazy(() => import("./MenuPreview"));
const isMenuPreview = import.meta.env.VITE_MENU_PREVIEW === "true";
const isPlatform =
  location.pathname === "/admin" || location.pathname.startsWith("/admin/");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<main>Loading workspace…</main>}>
      {isMenuPreview ? <MenuPreview /> : isPlatform ? <PlatformApp /> : <App />}
    </Suspense>
  </React.StrictMode>,
);
