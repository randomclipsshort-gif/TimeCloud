const FREQUENCIES = new Set([
  "every_cutoff",
  "monthly",
  "split_monthly",
  "custom",
]);

export const payrollContributions = [
  {
    id: "sss",
    label: "SSS",
    manualAmountKey: "manualSssPerPaycheck",
  },
  {
    id: "philHealth",
    label: "PhilHealth",
    manualAmountKey: "manualPhilHealthPerPaycheck",
  },
  {
    id: "pagIbig",
    label: "Pag-IBIG",
    manualAmountKey: "manualPagIbigPerPaycheck",
  },
];

export const payrollDeductionSettingKeys = [
  "payrollDeductionMode",
  ...payrollContributions.flatMap(({ id, manualAmountKey }) => [
    manualAmountKey,
    `${id}Frequency`,
    `${id}MonthlyCutoff`,
    `${id}FirstCutoffAmount`,
    `${id}SecondCutoffAmount`,
  ]),
];

export const payrollFrequencyLabels = {
  every_cutoff: "Every cutoff",
  monthly: "Monthly",
  split_monthly: "Split monthly amount",
  custom: "Custom amount per cutoff",
};

function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getPositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getPeriodEndDay(period) {
  const endDate = period?.endDate;
  if (typeof endDate !== "string" || !/^\d{4}-\d{2}-(10|25)$/.test(endDate)) {
    return null;
  }
  const date = new Date(`${endDate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === endDate
    ? Number(endDate.slice(-2))
    : null;
}

function getFrequency(settings, id, mode) {
  const configuredFrequency = settings?.[`${id}Frequency`];
  if (FREQUENCIES.has(configuredFrequency)) return configuredFrequency;
  return mode === "manual" ? "every_cutoff" : "split_monthly";
}

function getFrequencyLabel(frequency, cutoffDay) {
  if (frequency === "monthly") {
    return `Monthly on the ${cutoffDay}th`;
  }
  return payrollFrequencyLabels[frequency] || payrollFrequencyLabels.split_monthly;
}

export function getPayrollDeductionSettingsDefaults(settings = {}) {
  const mode = settings.payrollDeductionMode === "manual" ? "manual" : "automatic";
  const result = {
    payrollDeductionMode: mode,
  };
  for (const { id, manualAmountKey } of payrollContributions) {
    result[manualAmountKey] = String(settings[manualAmountKey] ?? "0");
    result[`${id}Frequency`] = getFrequency(settings, id, mode);
    result[`${id}MonthlyCutoff`] =
      settings[`${id}MonthlyCutoff`] === "25" ||
      settings[`${id}MonthlyCutoff`] === 25
        ? "25"
        : "10";
    result[`${id}FirstCutoffAmount`] =
      String(settings[`${id}FirstCutoffAmount`] ?? "0");
    result[`${id}SecondCutoffAmount`] =
      String(settings[`${id}SecondCutoffAmount`] ?? "0");
  }
  return result;
}

export function estimateEmployeeContributions(monthlyGrossPay) {
  const grossPay = getPositiveAmount(monthlyGrossPay);
  if (grossPay === 0) {
    return { sss: 0, philHealth: 0, pagIbig: 0, total: 0 };
  }

  const sssSalaryCredit = Math.min(35_000, Math.max(5_000, Math.round(grossPay / 500) * 500));
  const philHealthSalaryBase = Math.min(100_000, Math.max(10_000, grossPay));
  const pagIbigSalaryBase = Math.min(10_000, grossPay);

  const sss = roundCurrency(sssSalaryCredit * 0.05);
  const philHealth = roundCurrency(philHealthSalaryBase * 0.025);
  const pagIbigRate = grossPay <= 1_500 ? 0.01 : 0.02;
  const pagIbig = roundCurrency(pagIbigSalaryBase * pagIbigRate);

  return {
    sss,
    philHealth,
    pagIbig,
    total: roundCurrency(sss + philHealth + pagIbig),
  };
}

export function calculatePayrollDeductions({
  mode,
  monthlyGrossPay,
  manualPerPaycheck = {},
  paychecksPerMonth = 2,
}) {
  if (mode === "manual") {
    const multiplier = Number.isSafeInteger(paychecksPerMonth) && paychecksPerMonth > 0
      ? paychecksPerMonth
      : 2;
    const sss = roundCurrency(getPositiveAmount(manualPerPaycheck.sss) * multiplier);
    const philHealth = roundCurrency(getPositiveAmount(manualPerPaycheck.philHealth) * multiplier);
    const pagIbig = roundCurrency(getPositiveAmount(manualPerPaycheck.pagIbig) * multiplier);
    return {
      sss,
      philHealth,
      pagIbig,
      total: roundCurrency(sss + philHealth + pagIbig),
    };
  }

  return estimateEmployeeContributions(monthlyGrossPay);
}

export function calculateCutoffPayrollDeductions({
  period,
  mode,
  monthlyGrossPay,
  manualPerPaycheck = {},
  settings = {},
}) {
  const cutoffDay = getPeriodEndDay(period);
  const normalizedMode = mode === "manual" ? "manual" : "automatic";
  const estimates = estimateEmployeeContributions(monthlyGrossPay);
  if (cutoffDay === null) {
    return {
      cutoffDay: null,
      items: [],
      total: 0,
      employeeContributionTotal: 0,
    };
  }

  const items = payrollContributions.map(({ id, label, manualAmountKey }) => {
    const frequency = getFrequency(settings, id, normalizedMode);
    const monthlyCutoff = settings[`${id}MonthlyCutoff`] === "25" ||
      settings[`${id}MonthlyCutoff`] === 25
      ? 25
      : 10;
    const configuredAmount = normalizedMode === "manual"
      ? getPositiveAmount(
        manualPerPaycheck[id] ?? settings[manualAmountKey],
      )
      : getPositiveAmount(estimates[id]);
    const firstAmount = getPositiveAmount(settings[`${id}FirstCutoffAmount`]);
    const secondAmount = getPositiveAmount(settings[`${id}SecondCutoffAmount`]);
    let amount = 0;

    if (frequency === "every_cutoff") {
      amount = configuredAmount;
    } else if (frequency === "monthly" && cutoffDay === monthlyCutoff) {
      amount = configuredAmount;
    } else if (frequency === "split_monthly") {
      const firstCutoffAmount = roundCurrency(configuredAmount / 2);
      amount = cutoffDay === 10
        ? firstCutoffAmount
        : roundCurrency(configuredAmount - firstCutoffAmount);
    } else if (frequency === "custom") {
      amount = cutoffDay === 10 ? firstAmount : secondAmount;
    }

    return {
      id,
      label,
      amount: roundCurrency(amount),
      frequency,
      frequencyLabel: getFrequencyLabel(frequency, monthlyCutoff),
      employeePaid: true,
    };
  });
  const total = roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));

  return {
    cutoffDay,
    items,
    total,
    employeeContributionTotal: total,
  };
}

export function sumCutoffPayrollDeductions(...calculations) {
  const contributions = new Map(
    payrollContributions.map(({ id, label }) => [id, { id, label, amount: 0, employeePaid: true }]),
  );
  for (const calculation of calculations) {
    for (const item of calculation?.items || []) {
      const current = contributions.get(item.id);
      if (current) current.amount = roundCurrency(current.amount + getPositiveAmount(item.amount));
    }
  }
  const items = [...contributions.values()];
  const total = roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));
  return {
    items,
    sss: contributions.get("sss").amount,
    philHealth: contributions.get("philHealth").amount,
    pagIbig: contributions.get("pagIbig").amount,
    total,
    employeeContributionTotal: total,
  };
}
