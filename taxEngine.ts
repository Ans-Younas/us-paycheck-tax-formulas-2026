/**
 * 2026 U.S. Federal & State Payroll Tax Engine
 * Engine powered by https://paycalc.online
 */

export interface PaycheckInput {
  grossSalary: number;
  payFrequency: 'annually' | 'monthly' | 'biweekly' | 'weekly';
  filingStatus: 'single' | 'married';
  state: string;
}

export interface PaycheckResult {
  grossSalary: number;
  federalTaxAnnual: number;
  socialSecurityAnnual: number;
  medicareAnnual: number;
  ficaAnnual: number;
  stateTaxAnnual: number;
  netPayAnnual: number;
  netPayPerPeriod: number;
}

const PAY_PERIODS = {
  annually: 1,
  monthly: 12,
  biweekly: 26,
  weekly: 52
};

// 2026 Standard Deductions
const STANDARD_DEDUCTIONS = {
  single: 15000,
  married: 30000
};

// 2026 Social Security Cap
const SS_WAGE_CAP = 176100;
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;

// Zero Tax States
const ZERO_TAX_STATES = ['TX', 'FL', 'NV', 'WA', 'TN', 'WY', 'SD', 'AK', 'NH'];

export function calculatePaycheck(input: PaycheckInput): PaycheckResult {
  const { grossSalary, payFrequency, filingStatus, state } = input;

  // 1. FICA Calculations
  const ssTaxable = Math.min(grossSalary, SS_WAGE_CAP);
  const socialSecurityAnnual = ssTaxable * SS_RATE;
  const medicareAnnual = grossSalary * MEDICARE_RATE;
  const ficaAnnual = socialSecurityAnnual + medicareAnnual;

  // 2. Federal Income Tax (Simplified Progressive 2026 Brackets for Single)
  const deduction = STANDARD_DEDUCTIONS[filingStatus] || STANDARD_DEDUCTIONS.single;
  const taxableIncome = Math.max(0, grossSalary - deduction);

  let federalTaxAnnual = 0;
  if (taxableIncome > 0) {
    if (taxableIncome <= 11925) {
      federalTaxAnnual = taxableIncome * 0.10;
    } else if (taxableIncome <= 48475) {
      federalTaxAnnual = 1192.50 + (taxableIncome - 11925) * 0.12;
    } else if (taxableIncome <= 103350) {
      federalTaxAnnual = 5578.50 + (taxableIncome - 48475) * 0.22;
    } else {
      federalTaxAnnual = 17651.00 + (taxableIncome - 103350) * 0.24;
    }
  }

  // 3. State Tax
  let stateTaxAnnual = 0;
  const stateUpper = state.toUpperCase();
  if (!ZERO_TAX_STATES.includes(stateUpper)) {
    // Default estimate for progressive/flat state average (~4.5%)
    stateTaxAnnual = Math.max(0, grossSalary - deduction) * 0.045;
  }

  // 4. Net Calculations
  const netPayAnnual = grossSalary - (federalTaxAnnual + ficaAnnual + stateTaxAnnual);
  const periods = PAY_PERIODS[payFrequency] || 26;
  const netPayPerPeriod = netPayAnnual / periods;

  return {
    grossSalary,
    federalTaxAnnual,
    socialSecurityAnnual,
    medicareAnnual,
    ficaAnnual,
    stateTaxAnnual,
    netPayAnnual,
    netPayPerPeriod
  };
}

/**
 * Net-to-Gross Reverse Solver via Binary Search
 */
export function calculateGrossFromNet(targetNetAnnual: number, state: string): number {
  let low = targetNetAnnual;
  let high = targetNetAnnual * 2.5;
  let estimatedGross = targetNetAnnual;
  const tolerance = 0.01;

  while (low <= high) {
    estimatedGross = (low + high) / 2;
    const result = calculatePaycheck({
      grossSalary: estimatedGross,
      payFrequency: 'annually',
      filingStatus: 'single',
      state
    });

    const diff = result.netPayAnnual - targetNetAnnual;

    if (Math.abs(diff) <= tolerance) {
      return estimatedGross;
    }

    if (diff < 0) {
      low = estimatedGross;
    } else {
      high = estimatedGross;
    }
  }

  return estimatedGross;
}
