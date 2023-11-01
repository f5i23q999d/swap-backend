'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PMMState = void 0;
var bignumber_js_1 = require('bignumber.js');
bignumber_js_1.default.config({
  EXPONENTIAL_AT: [-80, 80],
  DECIMAL_PLACES: 80
});
var PMMState = /** @class */ (function () {
  function PMMState(pairDetail) {
    this.B = pairDetail.B;
    this.Q = pairDetail.Q;
    this.B0 = pairDetail.B0;
    this.Q0 = pairDetail.Q0;
    this.RStatus = pairDetail.R;
    this.OraclePrice = pairDetail.i;
    this.k = pairDetail.K;
    this.mtFeeRate = pairDetail.mtFeeRate;
    this.lpFeeRate = pairDetail.lpFeeRate;
  }
  return PMMState;
})();
exports.PMMState = PMMState;
