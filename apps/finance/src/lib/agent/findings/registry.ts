import type { Detector } from "./types";
import { subscriptionPriceIncreaseDetector } from "./detectors/subscriptionPriceIncrease";
import { idleCashDetector } from "./detectors/idleCash";
import { bankFeesDetector } from "./detectors/bankFees";
import { creditCardInterestDetector } from "./detectors/creditCardInterest";
import { annualRenewalDetector } from "./detectors/annualRenewal";
import { incomeAnomalyDetector } from "./detectors/incomeAnomaly";

/**
 * The registered detectors, run in order on every sweep. Adding a
 * detector is a one-line change here — the runner, schema, and UI don't
 * change, because they all speak the FindingDraft contract.
 */
export const DETECTORS: Detector[] = [
  subscriptionPriceIncreaseDetector,
  idleCashDetector,
  bankFeesDetector,
  creditCardInterestDetector,
  annualRenewalDetector,
  incomeAnomalyDetector,
];
