import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // 👈 이 줄이 반드시 있어야 스타일이 적용됩니다!
import "./theme.css"; // 👈 AI 테마 시스템 적용
import { OrbitProvider } from "./context/OrbitContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OrbitProvider>
      <App />
    </OrbitProvider>
  </React.StrictMode>
);
