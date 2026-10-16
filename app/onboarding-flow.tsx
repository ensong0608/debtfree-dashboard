"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  type PlannedAssignment,
  type PlannedDebt,
  type PlannedIncomeSource,
  type PlannedPayoffData,
} from "./dashboard-data";
import OutlineIcon from "./outline-icon";
import { calculatePlan } from "./payoff-engine";
import {
  buildOnboardingPlan,
  createIncomeSource,
  createPlannedDebt,
  debtTotals,
  onboardingStepIssues,
  recommendedDebtCapacity,
  normalizeIncome,
  totalPlannedExpenses,
  totalPlannedIncome,
  type GeneratedOnboardingPlan,
} from "./onboarding-plan";

const debtTypes: string[] = ["Credit card", "Personal loan", "Auto loan", "House loan", "Student loan", "Medical debt", "Other"];
const assignments: { value: PlannedAssignment; label: string }[] = [
  { value: "household", label: "Household" },
  { value: "partner-1", label: "Partner 1" },
  { value: "partner-2", label: "Partner 2" },
];
type EssentialExpenseKey = "housing" | "utilities" | "food" | "transportation" | "insurance" | "subscriptions" | "otherObligations" | "safetyBuffer";
const expenseFields: { key: EssentialExpenseKey; label: string }[] = [
  { key: "housing", label: "Housing" },
  { key: "utilities", label: "Utilities" },
  { key: "food", label: "Food" },
  { key: "transportation", label: "Transportation" },
  { key: "insurance", label: "Insurance" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "otherObligations", label: "Other obligations" },
  { key: "safetyBuffer", label: "Safety buffer" },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const preciseCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberValue = (value: string) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const newId = (prefix: string) => prefix + "-" + Date.now() + "-" + Math.random();

function readableMonth(month: string | null) {
  if (!month) return "Needs adjustment";
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export type OnboardingFlowProps = {
  planning: PlannedPayoffData;
  importMessage: string;
  onPlanningChange: (planning: PlannedPayoffData) => void;
  onImport: (file: File) => Promise<void>;
  onComplete: (result: GeneratedOnboardingPlan) => void;
};

export default function OnboardingFlow({ planning, importMessage, onPlanningChange, onImport, onComplete }: OnboardingFlowProps) {
  const step = Math.min(5, Math.max(1, planning.onboarding.currentStep));
  const shellRef = useRef<HTMLElement>(null);
  useEffect(() => { shellRef.current?.scrollTo({top: 0}); }, [step]);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const income = useMemo(() => totalPlannedIncome(planning.incomeSources), [planning.incomeSources]);
  const debtSummary = useMemo(() => debtTotals(planning.debts), [planning.debts]);
  const recommended = useMemo(() => recommendedDebtCapacity(income, planning.essentialExpenses), [income, planning.essentialExpenses]);
  const generated = useMemo(() => step === 5 ? buildOnboardingPlan(planning) : null, [planning, step]);

  const update = (next: Partial<PlannedPayoffData>) => onPlanningChange({ ...planning, ...next });
  const setStep = (next: number) => {
    setErrors([]);
    update({ onboarding: { ...planning.onboarding, currentStep: next } });
  };
  const nextStep = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = onboardingStepIssues(step, planning);
    if (nextErrors.length) {
      setErrors(nextErrors);
      window.requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setStep(Math.min(5, step + 1));
  };
  const updateIncome = (id: string, next: Partial<PlannedIncomeSource>) => update({
    incomeSources: planning.incomeSources.map((source) => source.id === id ? { ...source, ...next } : source),
  });
  const updateDebt = (id: string, next: Partial<PlannedDebt>) => update({
    debts: planning.debts.map((debt) => debt.id === id ? { ...debt, ...next } : debt),
  });
  const updateExpense = (key: EssentialExpenseKey, value: number) => {
    const essentialExpenses = { ...planning.essentialExpenses, [key]: value };
    update({
      essentialExpenses,
      capacity: planning.capacity.method === "calculated"
        ? { ...planning.capacity, monthlyAmount: recommendedDebtCapacity(income, essentialExpenses) }
        : planning.capacity,
    });
  };
  const chooseCapacityMethod = (method: "known" | "calculated") => update({
    capacity: {
      ...planning.capacity,
      method,
      monthlyAmount: method === "calculated" ? recommended : planning.capacity.monthlyAmount,
    },
  });
  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) void onImport(file).finally(() => { input.value = ""; });
  };

  const fieldError = (prefix: string, phrase: string) => errors.find(error => error.startsWith(prefix) && error.includes(phrase));
  const stepNames = ["Start", "Income", "Debts", "Capacity", "Plan"];
  const snowball = generated ? calculatePlan(generated.accounts, generated.extra, "snowball") : null;
  return <main ref={shellRef} className="onboarding-shell" aria-label="Household setup" tabIndex={0}>
    <header className="onboarding-brand"><span>DF</span><div><strong>DebtFree</strong><small>Household payoff setup</small></div></header>
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-progress" aria-label={"Step " + step + " of 5"}>
        <div className="step-caption"><strong>Step {step} of 5 · {stepNames[step - 1]}</strong><span>{(step - 1) * 25}% complete</span></div>
        <ol>{stepNames.map((name, index) => <li key={name} className={index + 1 < step ? "complete active" : index + 1 === step ? "active" : ""} aria-current={index + 1 === step ? "step" : undefined}><i aria-hidden="true">{index + 1 < step ? "✓" : index + 1}</i><span>{name}</span></li>)}</ol>
      </div>
      {errors.length > 0 && <div ref={errorRef} id="onboarding-errors" className="onboarding-errors" role="alert" aria-live="assertive" tabIndex={-1}><strong>Please review this step.</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

      {step === 1 && <div className="onboarding-welcome">
        <span className="onboarding-eyebrow">A focused plan in a few minutes</span>
        <h1 id="onboarding-title">Crush household debt, <em>together.</em></h1>
        <p>You only need monthly income, debt balances, minimum payments, and a comfortable payment amount. Transactions, payees, and receipts are not required.</p>
        <section className="welcome-preview"><span className="onboarding-eyebrow">Your path forward</span><h2>Snowball or Avalanche</h2><p>Start with your balances and a comfortable monthly amount. See your payoff timeline, then compare strategies in the app.</p></section>
        <div className="welcome-benefits"><article><span className="tool-icon"><OutlineIcon name="receipt"/></span><div><strong>A few essential numbers</strong><p>Income, balances and minimums. No bank connection needed.</p></div></article><article><span className="tool-icon orange"><OutlineIcon name="calculator"/></span><div><strong>Built around your monthly comfort</strong><p>Keep room for essentials and a safety buffer.</p></div></article><article><span className="tool-icon"><OutlineIcon name="home"/></span><div><strong>Your household, together</strong><p>Save your plan and keep backups in Settings.</p></div></article></div>
        <div className="onboarding-welcome-actions">
          <button className="primary" type="button" onClick={() => setStep(2)}>Start my payoff plan</button>
          <label className="secondary onboarding-import"><input type="file" accept=".json,application/json" onChange={importFile}/><span>Import existing data</span></label>
        </div>
        {importMessage && <p className={importMessage.startsWith("Import failed") ? "onboarding-import-message error" : "onboarding-import-message"} role="status">{importMessage}</p>}
        <small>Existing DebtFree Dashboard JSON backups are validated and migrated before anything is restored.</small>
      </div>}

      {step === 2 && <form className="onboarding-step" onSubmit={nextStep} noValidate>
        <header><span className="onboarding-eyebrow">Income</span><h1 id="onboarding-title">Household income</h1><p>Add each dependable monthly take-home source. Assignments are optional and partner names are not required.</p></header>
        <div className="onboarding-list">
          {planning.incomeSources.map((source, index) => <fieldset className="onboarding-row income-row" key={source.id}>
            <legend>Income source {index + 1}</legend>
            <label><span>Income source name</span><input value={source.name} onChange={(event) => updateIncome(source.id, { name: event.target.value })} aria-invalid={errors.some((error) => error.startsWith("Income source " + (index + 1))) || undefined} aria-describedby={errors.length ? "onboarding-errors" : undefined} placeholder="Salary or benefits"/>{fieldError("Income source " + (index + 1), "name") && <small className="setup-field-error">Enter an income source name.</small>}</label>
            <div className="income-frequency"><span>Pay frequency</span><div>{(["monthly", "biweekly", "weekly"] as const).map(frequency => <button type="button" key={frequency} aria-pressed={(source.payFrequency ?? "monthly") === frequency} onClick={() => { const amount = source.payAmount ?? source.monthlyTakeHome; updateIncome(source.id, { payFrequency: frequency, payAmount: amount, monthlyTakeHome: normalizeIncome(amount, frequency) }); }}>{frequency === "biweekly" ? "Biweekly" : frequency === "weekly" ? "Weekly" : "Monthly"}</button>)}</div></div>
            <label><span>{source.payFrequency && source.payFrequency !== "monthly" ? "Take-home amount per paycheck" : "Monthly take-home amount"}</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={(source.payAmount ?? source.monthlyTakeHome) || ""} onChange={(event) => updateIncome(source.id, { payAmount: numberValue(event.target.value), monthlyTakeHome: normalizeIncome(numberValue(event.target.value), source.payFrequency ?? "monthly") })} aria-invalid={errors.some((error) => error.startsWith("Income source " + (index + 1))) || undefined} aria-describedby={errors.length ? "onboarding-errors" : undefined}/></div></label>
            <p className="income-normalized">Monthly equivalent: {preciseCurrency.format(source.monthlyTakeHome)}</p>
            <label><span>Assignment (optional)</span><select value={source.assignment} onChange={(event) => updateIncome(source.id, { assignment: event.target.value as PlannedAssignment })}>{assignments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {planning.incomeSources.length > 1 && <button className="onboarding-remove" type="button" onClick={() => update({ incomeSources: planning.incomeSources.filter((item) => item.id !== source.id) })} aria-label={"Remove income source " + (index + 1)}>Remove</button>}
          </fieldset>)}
        </div>
        <button className="onboarding-add" type="button" onClick={() => update({ incomeSources: [...planning.incomeSources, createIncomeSource(newId("income"))] })}>+ Add another income source</button>
        <div className="onboarding-total"><span>Total monthly take-home</span><strong>{preciseCurrency.format(income)}</strong></div>
        <StepActions step={step} onBack={() => setStep(1)}/>
      </form>}

      {step === 3 && <form className="onboarding-step debt-step" onSubmit={nextStep} noValidate>
        <header><span className="onboarding-eyebrow">Debts</span><h1 id="onboarding-title">Add debts</h1><p>Add every debt here without leaving this screen. Start with the four numbers on your latest statement.</p></header>
        <div className="onboarding-list">
          {planning.debts.map((debt, index) => <fieldset className="onboarding-debt" key={debt.id}>
            <legend>Debt {index + 1}</legend>
            <label className="onboarding-type"><span>Debt type</span><select value={debt.trackerKind === "house" ? "House loan" : debt.type} onChange={event => { const type = event.target.value; updateDebt(debt.id, { type: type === "House loan" ? "Other" : type as PlannedDebt["type"], trackerKind: type === "House loan" ? "house" : type === "Auto loan" ? "car" : undefined }); }}>{debtTypes.map(type => <option key={type} value={type}>{type === "Auto loan" ? "Car loan" : type}</option>)}</select></label>
            <div className="onboarding-debt-basic">
              <label><span>Debt name</span><input value={debt.name} onChange={(event) => updateDebt(debt.id, { name: event.target.value })} aria-invalid={errors.some((error) => error.startsWith("Debt " + (index + 1))) || undefined} aria-describedby={errors.length ? "onboarding-errors" : undefined} placeholder="Rewards card"/>{fieldError("Debt " + (index + 1), "name") && <small className="setup-field-error">Enter a debt name.</small>}</label>
              <label><span>Current balance</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.balance || ""} onChange={(event) => updateDebt(debt.id, { balance: numberValue(event.target.value) })} aria-invalid={Boolean(fieldError("Debt " + (index + 1), "balance"))}/></div>{fieldError("Debt " + (index + 1), "balance") && <small className="setup-field-error">Enter a balance greater than $0.</small>}</label>
              <label><span>APR</span><div className="onboarding-money suffix"><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.apr || ""} onChange={(event) => updateDebt(debt.id, { apr: numberValue(event.target.value) })}/><b>%</b></div></label>
              <label><span>Minimum monthly payment</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.minimum || ""} onChange={(event) => updateDebt(debt.id, { minimum: numberValue(event.target.value) })} aria-invalid={Boolean(fieldError("Debt " + (index + 1), "minimum"))}/></div>{fieldError("Debt " + (index + 1), "minimum") && <small className="setup-field-error">Enter a minimum greater than $0.</small>}</label>
            </div>
            <details className="onboarding-advanced">
              <summary>Advanced details</summary>
              <div>
                <label><span>Due date</span><input type="date" value={debt.dueDate} onChange={(event) => updateDebt(debt.id, { dueDate: event.target.value })}/></label>
                <label><span>Credit limit</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.creditLimit || ""} onChange={(event) => updateDebt(debt.id, { creditLimit: numberValue(event.target.value) })}/></div></label>
                <label><span>Promotional expiration</span><input type="date" value={debt.promoEndDate} onChange={(event) => updateDebt(debt.id, { promoEndDate: event.target.value })}/></label>
                <label><span>Post-promotional APR</span><div className="onboarding-money suffix"><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.postPromoApr || ""} onChange={(event) => updateDebt(debt.id, { postPromoApr: numberValue(event.target.value) })}/><b>%</b></div></label>
                <label><span>Post-promotion minimum</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={debt.postPromoMinimum || ""} onChange={(event) => updateDebt(debt.id, { postPromoMinimum: numberValue(event.target.value) })}/></div></label>

                <label><span>Household member</span><select value={debt.assignment} onChange={(event) => updateDebt(debt.id, { assignment: event.target.value as PlannedAssignment })}>{assignments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="onboarding-check"><input type="checkbox" checked={debt.payoffMode === "minimum-only"} onChange={(event) => updateDebt(debt.id, { payoffMode: event.target.checked ? "minimum-only" : "priority" })}/><span>Minimum-only mode</span></label>
              </div>
            </details>
            {planning.debts.length > 1 && <button className="onboarding-remove" type="button" onClick={() => update({ debts: planning.debts.filter((item) => item.id !== debt.id) })} aria-label={"Remove debt " + (index + 1)}>Remove debt</button>}
          </fieldset>)}
        </div>
        <button className="onboarding-add" type="button" onClick={() => update({ debts: [...planning.debts, createPlannedDebt(newId("debt"))] })}>+ Add another debt</button>
        <div className="onboarding-running-totals" aria-live="polite">
          <div><span>Total debt</span><strong>{preciseCurrency.format(debtSummary.debt)}</strong></div>
          <div><span>Total minimums</span><strong>{preciseCurrency.format(debtSummary.minimums)}</strong></div>
          <div><span>Weighted-average APR</span><strong>{debtSummary.weightedApr.toFixed(2)}%</strong></div>
        </div>
        <StepActions step={step} onBack={() => setStep(2)}/>
      </form>}

      {step === 4 && <form className="onboarding-step" onSubmit={nextStep} noValidate>
        <header><span className="onboarding-eyebrow">Payment capacity</span><h1 id="onboarding-title">Monthly debt-payment capacity</h1><p>Choose the quickest path. Your amount includes all minimum payments; we convert only the amount above minimums into extra payment.</p></header>
        <div className="capacity-paths" role="group" aria-label="Choose how to set monthly debt-payment capacity">
          <button type="button" className={planning.capacity.method === "known" ? "active" : ""} aria-pressed={planning.capacity.method === "known"} onClick={() => chooseCapacityMethod("known")}><strong>I know the amount</strong><span>Enter one total monthly debt payment.</span></button>
          <button type="button" className={planning.capacity.method === "calculated" ? "active" : ""} aria-pressed={planning.capacity.method === "calculated"} onClick={() => chooseCapacityMethod("calculated")}><strong>Help me calculate</strong><span>Use income, essentials, and a safety buffer.</span></button>
        </div>
        {planning.capacity.method === "calculated" && <div className="expense-grid">
          {planning.debts.some(debt => debt.trackerKind) && <p className="setup-loan-guidance">Enter essentials excluding house/car payments added in Debts. Those payments are reserved separately.</p>}
          {expenseFields.map((field) => <label key={field.key}><span>{field.label}</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={planning.essentialExpenses[field.key] || ""} onChange={(event) => updateExpense(field.key, numberValue(event.target.value))}/></div></label>)}
          <div className="capacity-math" aria-live="polite"><span>{currency.format(income)} income - {currency.format(totalPlannedExpenses(planning.essentialExpenses))} essentials - {currency.format(planning.essentialExpenses.safetyBuffer)} buffer</span><strong>{preciseCurrency.format(recommended)} recommended</strong></div>
        </div>}
        <label className="capacity-amount"><span>{planning.capacity.method === "calculated" ? "Adjusted monthly debt-payment amount" : "Total monthly debt-payment amount"}</span><div className="onboarding-money"><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={planning.capacity.monthlyAmount || ""} onChange={(event) => update({ capacity: { ...planning.capacity, monthlyAmount: numberValue(event.target.value) } })} aria-invalid={errors.length > 0 || undefined} aria-describedby={errors.length ? "onboarding-errors" : "capacity-help"}/></div><small id="capacity-help">This amount includes {preciseCurrency.format(debtSummary.minimums)} in minimum payments.</small></label>
        {planning.capacity.monthlyAmount > 0 && planning.capacity.monthlyAmount < debtSummary.minimums && <p className="capacity-warning" role="status">This is below your minimum payments. The plan requires the full minimums with $0 extra. Review affordability before continuing.</p>}
        {planning.capacity.monthlyAmount > recommended && income > 0 && <p className="capacity-warning" role="status">This is above the {preciseCurrency.format(recommended)} left after your entered essentials and buffer. Check that it is affordable.</p>}
        <StepActions step={step} onBack={() => setStep(3)} nextLabel="Generate my plan"/>
      </form>}

      {step === 5 && generated && <div className="onboarding-step onboarding-result">
        <header><span className="onboarding-eyebrow">Plan generated</span><h1 id="onboarding-title">Your payoff plan is ready</h1><strong className="result-date">{generated.accounts.length && !generated.plan.stalled ? "Cards & other paid off by " + readableMonth(generated.debtFreeMonth) : "Review your payment plan"}</strong><p>The result below comes directly from the payoff calculation. You can adjust every advanced setting after setup.</p></header>
        <div className="onboarding-result-grid">
          <div><span>Total debt</span><strong>{preciseCurrency.format(generated.totals.debt)}</strong></div>
          <div><span>Cards & other monthly payment</span><strong>{preciseCurrency.format(generated.plan.monthly)}</strong></div>
          <div><span>Extra above minimums</span><strong>{preciseCurrency.format(generated.extra)}</strong></div>
          <div><span>Recommended strategy</span><strong>Avalanche</strong></div>
          <div><span>First debt to target</span><strong>{generated.firstTarget ?? "Minimums only"}</strong></div>
          <div><span>Estimated debt-free date</span><strong>{readableMonth(generated.debtFreeMonth)}</strong></div>
          <div><span>Estimated total interest</span><strong>{preciseCurrency.format(generated.plan.totalInterest)}</strong></div>
          <div><span>Number of debts</span><strong>{generated.accounts.length}</strong></div>
        </div>
        {generated.loanTrackers.length > 0 && <p className="capacity-warning">House & car: {preciseCurrency.format(generated.loanMinimums)} monthly reserved separately. The forecast covers Cards & other; loan balances remain in House & car.</p>}
        <section className="setup-strategies"><h2>Avalanche selected</h2><p>Highest interest first. You can compare and change strategies in Payoff Plan.</p><div><article><strong>Avalanche</strong><small>Highest APR first</small>{generated.plan.stalled || !generated.accounts.length ? "Needs adjustment" : generated.plan.months.length + " months"}<small>{preciseCurrency.format(generated.plan.totalInterest)} estimated interest</small></article><article><strong>Snowball</strong><small>Smallest balance first</small>{snowball?.stalled || !generated.accounts.length ? "Needs adjustment" : snowball?.months.length + " months"}<small>{preciseCurrency.format(snowball?.totalInterest ?? 0)} estimated interest</small></article></div></section>
        {generated.plan.stalled && <p className="capacity-warning" role="status">This plan does not amortize under the current payment settings. Continue and adjust the payment or debt details in Payoff Plan.</p>}
        <div className="onboarding-actions"><button className="secondary" type="button" onClick={() => setStep(4)}>Back</button><button className="primary" type="button" onClick={() => onComplete(buildOnboardingPlan(planning))}>Continue into the application</button></div>
      </div>}
    </section>
  </main>;
}

function StepActions({ step, onBack, nextLabel = "Continue" }: { step: number; onBack: () => void; nextLabel?: string }) {
  return <div className="onboarding-actions"><button className="secondary" type="button" onClick={onBack}>Back</button><button className="primary" type="submit">{nextLabel}</button><span>Step {step} of 5</span></div>;
}
