import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tema.scss";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "sweetalert2/dist/sweetalert2.min.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
