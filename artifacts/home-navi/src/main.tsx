import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installOfflineFetch } from "./lib/offlineManager";

installOfflineFetch();

createRoot(document.getElementById("root")!).render(<App />);
