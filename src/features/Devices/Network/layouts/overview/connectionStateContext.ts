import { createContext, useContext } from "react";

/** Off while the platform's network scan is disabled - there are no live connection states to show then. */
export const ShowConnectionStateContext = createContext(true);

export const useShowConnectionState = () => useContext(ShowConnectionStateContext);
