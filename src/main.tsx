import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <div className="p-8 text-white">Number Bomb — scaffold OK</div>
  </StrictMode>
);
