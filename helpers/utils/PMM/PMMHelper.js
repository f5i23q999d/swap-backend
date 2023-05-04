"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.solveQuadraticFunctionForTarget = exports.solveQuadraticFunctionForTrade = exports.integrate = exports.PMMHelper = exports.RStatusBelowOne = exports.RStatusAboveOne = exports.RStatusOne = void 0;
var bignumber_js_1 = require("bignumber.js");
bignumber_js_1.default.config({
    EXPONENTIAL_AT: [-80, 80],
    DECIMAL_PLACES: 80,
});
exports.RStatusOne = 0;
exports.RStatusAboveOne = 1;
exports.RStatusBelowOne = 2;
var PMMHelper = /** @class */ (function () {
    function PMMHelper() {
    }
    // return received quote amount (fee deducted)
    PMMHelper.prototype.QuerySellBase = function (amount, state) {
        try {
            var result = void 0;
            if (state.RStatus === exports.RStatusOne) {
                result = this.ROneSellBase(amount, state);
            }
            else if (state.RStatus === exports.RStatusAboveOne) {
                var backToOnePayBase = state.B0.minus(state.B);
                var backToOneReceiveQuote = state.Q.minus(state.Q0);
                if (amount.lt(backToOnePayBase)) {
                    result = this.RAboveSellBase(amount, state);
                    if (result.gt(backToOneReceiveQuote)) {
                        result = backToOneReceiveQuote;
                    }
                }
                else if (amount.eq(backToOnePayBase)) {
                    result = backToOneReceiveQuote;
                }
                else {
                    result = backToOneReceiveQuote.plus(this.ROneSellBase(amount.minus(backToOnePayBase), state));
                }
            }
            else {
                result = this.RBelowSellBase(amount, state);
            }
            var mtFee = result.multipliedBy(state.mtFeeRate);
            var lpFee = result.multipliedBy(state.lpFeeRate);
            var quote = result.minus(mtFee).minus(lpFee);
            return quote;
        }
        catch (error) {
            return new bignumber_js_1.default(0);
        }
    };
    // return received base amount (fee deducted)
    PMMHelper.prototype.QuerySellQuote = function (amount, state) {
        try {
            var result = void 0;
            if (state.RStatus === exports.RStatusOne) {
                result = this.ROneSellQuote(amount, state);
            }
            else if (state.RStatus === exports.RStatusAboveOne) {
                result = this.RAboveSellQuote(amount, state);
            }
            else {
                var backToOneReceiveBase = state.B.minus(state.B0);
                var backToOnePayQuote = state.Q0.minus(state.Q);
                if (amount.lt(backToOnePayQuote)) {
                    result = this.RBelowSellQuote(amount, state);
                    if (result.gt(backToOneReceiveBase))
                        result = backToOneReceiveBase;
                }
                else if (amount.eq(backToOnePayQuote)) {
                    result = backToOneReceiveBase;
                }
                else {
                    result = backToOneReceiveBase.plus(this.ROneSellQuote(amount.minus(backToOnePayQuote), state));
                }
            }
            var mtFee = result.multipliedBy(state.mtFeeRate);
            var lpFee = result.multipliedBy(state.lpFeeRate);
            var base = result.minus(mtFee).minus(lpFee);
            return base;
        }
        catch (error) {
            return new bignumber_js_1.default(0);
        }
    };
    // return getMidPrice
    PMMHelper.prototype.GetMidPrice = function (state) {
        if (state.RStatus == exports.RStatusBelowOne) {
            var r = (state.Q0.multipliedBy(state.Q0).div(state.Q)).div(state.Q);
            r = new bignumber_js_1.default(1).minus(state.k).plus(state.k.multipliedBy(r));
            return state.OraclePrice.div(r);
        }
        else {
            var r = (state.B0.multipliedBy(state.B0).div(state.B)).div(state.B);
            r = new bignumber_js_1.default(1).minus(state.k).plus(state.k.multipliedBy(r));
            return state.OraclePrice.multipliedBy(r);
        }
    };
    // =========== helper ROne ===========
    PMMHelper.prototype.ROneSellBase = function (amount, state) {
        return (0, exports.solveQuadraticFunctionForTrade)(state.Q0, state.Q0, amount, state.OraclePrice, state.k);
    };
    PMMHelper.prototype.ROneSellQuote = function (amount, state) {
        return (0, exports.solveQuadraticFunctionForTrade)(state.B0, state.B0, amount, new bignumber_js_1.default(1).div(state.OraclePrice), state.k);
    };
    // =========== helper RAbove ===========
    PMMHelper.prototype.RAboveSellBase = function (amount, state) {
        return (0, exports.integrate)(state.B0, state.B.plus(amount), state.B, state.OraclePrice, state.k);
    };
    PMMHelper.prototype.RAboveSellQuote = function (amount, state) {
        return (0, exports.solveQuadraticFunctionForTrade)(state.B0, state.B, amount, new bignumber_js_1.default(1).div(state.OraclePrice), state.k);
    };
    // =========== helper RBelow ===========
    PMMHelper.prototype.RBelowSellQuote = function (amount, state) {
        return (0, exports.integrate)(state.Q0, state.Q.plus(amount), state.Q, new bignumber_js_1.default(1).div(state.OraclePrice), state.k);
    };
    PMMHelper.prototype.RBelowSellBase = function (amount, state) {
        return (0, exports.solveQuadraticFunctionForTrade)(state.Q0, state.Q, amount, state.OraclePrice, state.k);
    };
    return PMMHelper;
}());
exports.PMMHelper = PMMHelper;
var integrate = function (V0, V1, V2, i, k) {
    if (V0.lte(0))
        throw new Error("TARGET_IS_ZERO");
    var fairAmount = i.multipliedBy(V1.minus(V2));
    if (k.eq(0))
        return fairAmount;
    var penalty = V0.multipliedBy(V0)
        .div(V1)
        .div(V2)
        .multipliedBy(k);
    return fairAmount.multipliedBy(new bignumber_js_1.default(1).minus(k).plus(penalty));
};
exports.integrate = integrate;
var solveQuadraticFunctionForTrade = function (V0, V1, delta, i, k) {
    if (V0.lte(0))
        throw new Error("TARGET_IS_ZERO");
    if (delta.eq(0))
        return delta;
    if (k.eq(0)) {
        return delta.multipliedBy(i).gt(V1) ? V1 : delta.multipliedBy(i);
    }
    if (k.eq(1)) {
        var tmp = i.multipliedBy(delta).multipliedBy(V1).div(V0.multipliedBy(V0));
        return V1.multipliedBy(tmp).div(tmp.plus(1));
    }
    var part2 = k.multipliedBy(V0).div(V1).multipliedBy(V0).plus(i.multipliedBy(delta));
    var bAbs = new bignumber_js_1.default(1).minus(k).multipliedBy(V1);
    var bSig;
    if (bAbs.gte(part2)) {
        bAbs = bAbs.minus(part2);
        bSig = false;
    }
    else {
        bAbs = part2.minus(bAbs);
        bSig = true;
    }
    var squareRoot = new bignumber_js_1.default(4)
        .multipliedBy(new bignumber_js_1.default(1).minus(k))
        .multipliedBy(k)
        .multipliedBy(V0)
        .multipliedBy(V0);
    squareRoot = bAbs
        .multipliedBy(bAbs)
        .plus(squareRoot)
        .sqrt();
    var denominator = new bignumber_js_1.default(2).multipliedBy(new bignumber_js_1.default(1).minus(k));
    var numerator;
    if (bSig) {
        numerator = squareRoot.minus(bAbs);
    }
    else {
        numerator = bAbs.plus(squareRoot);
    }
    return V1.minus(numerator.div(denominator));
};
exports.solveQuadraticFunctionForTrade = solveQuadraticFunctionForTrade;
var solveQuadraticFunctionForTarget = function (V1, delta, i, k) {
    if (V1.eq(0))
        return new bignumber_js_1.default(0);
    if (k.eq(0)) {
        return V1.plus(i.multipliedBy(delta));
    }
    var sqrt = k.multipliedBy(4).multipliedBy(i).multipliedBy(delta).div(V1).plus(1).sqrt();
    var premium = sqrt.minus(1).div(k.multipliedBy(2)).plus(1);
    return V1.multipliedBy(premium);
};
exports.solveQuadraticFunctionForTarget = solveQuadraticFunctionForTarget;
