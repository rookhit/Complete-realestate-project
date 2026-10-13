
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // A photo that fails to load (e.g. its file is missing from storage) would show its alt text
  // in the top-left corner. Hide it instead so the frame's background shows; show it again
  // when a later src loads. Image error/load events don't bubble, hence the capture phase.
  document.addEventListener("error", (e) => {
    if (e.target instanceof HTMLImageElement) e.target.style.visibility = "hidden";
  }, true);
  document.addEventListener("load", (e) => {
    if (e.target instanceof HTMLImageElement) e.target.style.visibility = "";
  }, true);

  createRoot(document.getElementById("root")!).render(<App />);
  