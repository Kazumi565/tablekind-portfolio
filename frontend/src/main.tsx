import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { lazy, Suspense } from "react";
import "./style.css";
import "./refinement.css";

const PlatformApp = lazy(() => import("./PlatformApp"));
const isPlatform =
  location.pathname === "/admin" || location.pathname.startsWith("/admin/");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<main>Loading workspace…</main>}>
      {isPlatform ? <PlatformApp /> : <App />}
    </Suspense>
  </React.StrictMode>,
);
