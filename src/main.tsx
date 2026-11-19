import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import "./lib/browsers/registerBrowsers";

import { AuthProvider } from "./auth";
import AppearanceStyles from "./features/Appearance/AppearanceStyles";

const root = ReactDOM.createRoot(
	document.getElementById("root") as HTMLElement
);

root.render(
	<React.StrictMode>
		<AppearanceStyles />
		<AuthProvider>
			<App />
		</AuthProvider>
	</React.StrictMode>
);
