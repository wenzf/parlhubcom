
import { createContext } from "react";
import { createContext as createReactRouterContext } from "react-router";
import type { Settings } from "../../../types/site";

export const settingsSessionContext = createReactRouterContext<Settings  | null>(null);

export const NonceContext = createContext<string>("");
