/** Optional flags keep entered details available when their switches are off. */
export type DebtTerms={type?:string;apr:number;postPromoApr:number;promoEndDate:string;promoApr?:number;promoEnabled?:boolean};
export function regularApr(account:DebtTerms){return (account.type===undefined||account.type==='Credit card')&&account.promoApr===undefined&&account.promoEndDate&&account.postPromoApr>0?account.postPromoApr:account.apr;}
export function promotionalApr(account:DebtTerms){return account.promoApr??(account.promoEndDate&&account.postPromoApr>0?account.apr:0);}
export function promoEnabled(account:Pick<DebtTerms,'promoEnabled'|'promoEndDate'>){return account.promoEnabled??Boolean(account.promoEndDate);}
export function activeCreditLimit(account:{creditLimit:number;creditLimitEnabled?:boolean}){return account.creditLimitEnabled===false?0:account.creditLimit;}

export function debtDetailMetadata<T extends {customNote?:string;customNoteEnabled?:boolean;creditLimitEnabled?:boolean;promoEnabled?:boolean;promoApr?:number}>(value:T) {
 return Object.fromEntries(['customNote','customNoteEnabled','creditLimitEnabled','promoEnabled','promoApr'].filter(key=>value[key as keyof T]!==undefined).map(key=>[key,value[key as keyof T]])) as Pick<T,'customNote'|'customNoteEnabled'|'creditLimitEnabled'|'promoEnabled'|'promoApr'>;
}

/** Current and projected rates share an inclusive promotion end date.
 * The persisted model has no promotion start date or balance-specific buckets.
 * Dated interest estimates may supply their historically saved regular rate. */
export function effectiveAprOn(account: DebtTerms, date: string, datedRegularApr = regularApr(account)) {
  const applicable = (account.type === undefined || account.type === 'Credit card') && promoEnabled(account) && account.promoEndDate && (account.promoApr !== undefined || account.postPromoApr > 0);
  if (!applicable) return datedRegularApr;
  if (date <= account.promoEndDate) return promotionalApr(account);
  return account.promoApr === undefined && account.postPromoApr > 0 ? account.postPromoApr : datedRegularApr;
}
