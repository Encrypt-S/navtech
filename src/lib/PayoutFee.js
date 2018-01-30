const lodash = require('lodash')

let Logger = require('./Logger.js') // eslint-disable-line
let SendToAddress = require('./SendToAddress.js') // eslint-disable-line
const privateSettings = require('../settings/private.settings.json')

const PayoutFee = {}

PayoutFee.run = (options, callback) => {
  const required = ['settings', 'navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PAY_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to PayoutFee.run' })
    return
  }
  PayoutFee.runtime = {
    callback,
    settings: options.settings,
    navClient: options.navClient,
  }
  PayoutFee.send()
}

PayoutFee.send = () => {
  PayoutFee.runtime.navClient.listUnspent(200).then((unspent) => {
    let navBalanceSat = 0
    const satoshiFactor = 100000000
    for (const pending of unspent) {
      navBalanceSat += Math.round(pending.amount * satoshiFactor)
    }
    const navBalance = navBalanceSat / satoshiFactor
    if (navBalance < PayoutFee.runtime.settings.navPoolAmount) {
      Logger.writeLog('PAY_002', 'nav pool balance less than expected', {
        navPoolAmount: PayoutFee.runtime.settings.navPoolAmount,
        navBalance,
      })
      PayoutFee.runtime.callback(false, { message: 'nav pool balance less than expected' })
      return
    }

    const txFeeAccrued = (navBalance - PayoutFee.runtime.settings.navPoolAmount) - privateSettings.txFee
    if (txFeeAccrued < PayoutFee.runtime.settings.txFeePayoutMin) {
      PayoutFee.runtime.callback(false, { message: 'fee accrued less than payout minimum' })
      return
    }
    SendToAddress.send({
      client: PayoutFee.runtime.navClient,
      address: PayoutFee.runtime.settings.anonTxFeeAddress,
      amount: txFeeAccrued,
      transaction: { txid: 'TX_FEE_PAYOUT' },
    }, PayoutFee.sent)
  }).catch((err) => {
    Logger.writeLog('PAY_002A', 'error getting balance', { error: err })
    PayoutFee.runtime.callback(false, { message: 'error getting balance' })
    return
  })
}

PayoutFee.sent = (success, data) => {
  if (!success) {
    PayoutFee.runtime.callback(false, { message: 'failed to send fee payout' })
    return
  }
  PayoutFee.runtime.callback(true, data)
}

module.exports = PayoutFee
