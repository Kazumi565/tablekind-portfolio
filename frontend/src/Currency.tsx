import { createContext, useContext } from "react";
import { money as formatMoney } from "./api";

export const CurrencyContext = createContext("MDL");
export function useMoney() {
  const currency = useContext(CurrencyContext);
  return {
    currency,
    money: (minor: number, override = currency) => formatMoney(minor, override),
  };
}
