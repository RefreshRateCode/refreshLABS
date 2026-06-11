import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { BrandFilter } from "../lib/brand";

const KEY = "noalanpro.brand";

type BrandCtx = {
  brand: BrandFilter;
  setBrand: (b: BrandFilter) => void;
};

const Ctx = createContext<BrandCtx | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<BrandFilter>(() => {
    try {
      return (localStorage.getItem(KEY) as BrandFilter) || "all";
    } catch {
      return "all";
    }
  });
  const setBrand = (b: BrandFilter) => {
    setBrandState(b);
    try {
      localStorage.setItem(KEY, b);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ brand, setBrand }}>{children}</Ctx.Provider>;
}

export function useBrand(): BrandCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBrand must be used within BrandProvider");
  return ctx;
}
