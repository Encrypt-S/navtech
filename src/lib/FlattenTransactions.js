const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line

const FlattenTransactions = {}

FlattenTransactions.incoming = (options, callback) => {
  const required = ['amountToFlatten', 'anonFeePercent']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('FLT_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to FlattenTransactions.incoming' })
    return
  }
  const unsafeAmount = options.amountToFlatten - (options.amountToFlatten * options.anonFeePercent / 100)
  FlattenTransactions.runtime = {
    callback,
    amountToFlatten: FlattenTransactions.satoshiParser(unsafeAmount),
  }
  FlattenTransactions.flattenIncoming()
}

FlattenTransactions.flattenIncoming = () => {
  console.log('FlattenTransactions.runtime.amountToFlatten', FlattenTransactions.runtime.amountToFlatten)
  const totalInt = Math.floor(FlattenTransactions.runtime.amountToFlatten)
  const totalIntString = totalInt.toString()
  const decimal = FlattenTransactions.runtime.amountToFlatten - totalInt
  const safeDecimal = FlattenTransactions.satoshiParser(decimal)

  let flattened = []

  for (let i = 0; i < totalIntString.length; i++) {
    const factor = 1 * Math.pow(10, totalIntString.length - (i + 1))
    const numFactors = parseInt(totalIntString[i], 10)
    for (let j = 0; j < numFactors; j++) {
      if (safeDecimal > 0 && lodash.sum(flattened) === totalInt - factor) {
        flattened.push(FlattenTransactions.satoshiParser(parseInt(factor, 10) + safeDecimal))
      } else {
        flattened.push(parseInt(factor, 10))
      }
    }
  }

  if (flattened.length === 1) {
    flattened = []
    for (let k = 0; k < 10; k++) {
      if (safeDecimal > 0 && k === 9) {
        flattened.push(FlattenTransactions.satoshiParser((totalInt / 10) + safeDecimal))
      } else {
        flattened.push(totalInt / 10)
      }
    }
  }

  const reduced = flattened.reduce((acc, x) => x + acc, 0)
  const safeReduced = FlattenTransactions.satoshiParser(reduced)

  if (safeReduced !== FlattenTransactions.runtime.amountToFlatten) {
    Logger.writeLog('FLT_002', 'unable to correctly flatten amount', { runtime: FlattenTransactions.runtime, flattened })
    FlattenTransactions.runtime.callback(false, {
      flattened,
    })
    return
  }

  FlattenTransactions.runtime.callback(true, {
    flattened,
  })
}

FlattenTransactions.satoshiParser = (unsafe) => {
  const satoshiFactor = 100000000
  return Math.round(unsafe * satoshiFactor) / satoshiFactor
}

module.exports = FlattenTransactions
