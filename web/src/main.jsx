import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "swiper/css/bundle";
import "flatpickr/dist/flatpickr.css";
import "leaflet/dist/leaflet.css";

import App from "./App.jsx";
import { AppWrapper } from "./components/common/PageMeta";
import { ThemeProvider } from "./context/ThemeContext";

const root = document.getElementById("root");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
