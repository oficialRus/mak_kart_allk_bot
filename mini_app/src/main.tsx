import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SplashOverlay from "./SplashOverlay";
import "./index.css";

function Root() {
  const [showSplash, setShowSplash] = useState(true);
  const onSplashFinished = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash ? <SplashOverlay onFinished={onSplashFinished} /> : null}
      <App />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
