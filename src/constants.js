const PLATFORM_FEE_RATE = 0.09;   // platform brokerage fee
const BROKERAGE_FEE_RATE = 0.15;  // freight brokerage fee (15%)
const DRIVER_SHARE_RATE = 0.85;   // driver keeps 85% after freight brokerage
const MAX_DETOUR_MILES = 5;       // max acceptable detour for route-stop GPS

// WeldScan 3D pricing (in USD)
const WELDSCAN_PDF_PRICE_USD = 2.99;   // pay-per-blueprint PDF export
const WELDSCAN_DXF_PRICE_USD = 9.99;   // CNC-ready DXF export

module.exports = {
  PLATFORM_FEE_RATE,
  BROKERAGE_FEE_RATE,
  DRIVER_SHARE_RATE,
  MAX_DETOUR_MILES,
  WELDSCAN_PDF_PRICE_USD,
  WELDSCAN_DXF_PRICE_USD,
};
