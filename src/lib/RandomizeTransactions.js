const lodash = require('lodash')

const Logger = require('./Logger.js')
const privateSettings = require('../settings/private.settings.json')

const RandomizeTransactions = {}

RandomizeTransactions.incoming = (options, callback) => {
  const required = ['totalToSend', 'addresses']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RND_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RandomizeTransactions.incoming' })
    return
  }

  RandomizeTransactions.runtime = {
    callback,
    totalToSend: options.totalToSend,
    addresses: options.addresses,
    transactions: {},
  }
  RandomizeTransactions.randomizeIncoming()
}

RandomizeTransactions.randomizeIncoming = () => {
  const satoshiFactor = 100000000
  const sumPendingSatoshi = RandomizeTransactions.runtime.totalToSend * satoshiFactor
  const txFeeSatoshi = privateSettings.txFee * satoshiFactor
  const txFeesSatoshi = txFeeSatoshi * RandomizeTransactions.runtime.addresses.length
  const sumProcessed = sumPendingSatoshi - txFeesSatoshi
  let runningTotal = 0

  const rangeMiddle = sumProcessed / RandomizeTransactions.runtime.addresses.length
  const rangeTop = Math.floor(rangeMiddle * 1.5 * satoshiFactor)
  const rangeBottom = Math.floor(rangeMiddle * 0.5 * satoshiFactor)

  for (let i = 0; i < RandomizeTransactions.runtime.addresses.length; i++) {
    if (runningTotal < sumProcessed) {
      const randSatoshis = Math.random() * (rangeTop - rangeBottom) + rangeBottom
      const randAmount = Math.round(randSatoshis / satoshiFactor)

      if (randAmount > sumProcessed - runningTotal || i === RandomizeTransactions.runtime.addresses.length - 1) {
        const remainingAmount = Math.round(sumProcessed - runningTotal)
        RandomizeTransactions.runtime.transactions[RandomizeTransactions.runtime.addresses[i]] = remainingAmount / satoshiFactor
        runningTotal += remainingAmount
      } else {
        RandomizeTransactions.runtime.transactions[RandomizeTransactions.runtime.addresses[i]] = randAmount / satoshiFactor
        runningTotal += randAmount
      }
    }
  }
  RandomizeTransactions.runtime.callback(true, {
    transactions: RandomizeTransactions.runtime.transactions,
  })
}

RandomizeTransactions.outgoing = (options, callback) => {
  const required = ['transaction', 'address', 'amount']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RND_002', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RandomizeTransactions.outgoing' })
    return
  }

  RandomizeTransactions.runtime = {
    callback,
    transaction: options.transaction,
    address: options.address,
    amount: options.amount,
    transactions: [],
  }
  RandomizeTransactions.randomizeOutgoing()
}

RandomizeTransactions.randomizeOutgoing = () => {
  const numTransactions = Math.ceil(
    Math.random() * (privateSettings.maxNavTransactions - privateSettings.minNavTransactions)
  ) + privateSettings.minNavTransactions
  const sumPending = RandomizeTransactions.runtime.amount
  const satoshiFactor = 100000000
  const sumPendingSatoshi = sumPending * satoshiFactor
  let runningTotal = 0

  const rangeMiddle = sumPendingSatoshi / numTransactions
  const rangeTop = Math.floor(rangeMiddle * 1.5 * satoshiFactor)
  const rangeBottom = Math.floor(rangeMiddle * 0.5 * satoshiFactor)

  for (let i = 0; i < numTransactions; i++) {
    if (runningTotal < sumPendingSatoshi) {
      const randSatoshis = Math.random() * (rangeTop - rangeBottom) + rangeBottom
      const randAmount = Math.round(randSatoshis / satoshiFactor)

      if (randAmount > sumPendingSatoshi - runningTotal || i === numTransactions - 1) {
        const remainingAmount = Math.round(sumPendingSatoshi - runningTotal)
        RandomizeTransactions.runtime.transactions.push(remainingAmount / satoshiFactor)
        runningTotal += remainingAmount
      } else {
        RandomizeTransactions.runtime.transactions.push(randAmount / satoshiFactor)
        runningTotal += randAmount
      }
    }
  }
  RandomizeTransactions.runtime.callback(true, {
    partialTransactions: RandomizeTransactions.runtime.transactions,
  })
}

RandomizeTransactions.getRandomAccountAddresses = (options, callback) => {
  const required = ['client', 'accountName', 'numAddresses']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RND_003', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RandomizeTransactions.getRandomAccountAddresses' })
    return
  }
  options.client.getAddressesByAccount(options.accountName).then((addresses) => {
    RandomizeTransactions.chooseRandomAddresses({
      accountName: options.accountName,
      numAddresses: options.numAddresses,
      addresses,
    }, callback)
    return
  })
  .catch((err) => {
    Logger.writeLog('RND_004', 'get account address failed', { options, error: err })
    callback(false, { message: 'get account address failed' })
    return
  })
}

RandomizeTransactions.chooseRandomAddresses = (options, callback) => {
  const required = ['addresses', 'accountName', 'numAddresses']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RND_005', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RandomizeTransactions.chooseRandomAddresses' })
    return
  }
  const pickedAddresses = []
  let counter = 0
  while (pickedAddresses.length < options.numAddresses && counter < 10000) {
    const randIndex = Math.floor(Math.random() * (options.addresses.length))
    if (options.addresses[randIndex]) {
      pickedAddresses.push(options.addresses[randIndex])
      options.addresses.splice(randIndex, 1)
    }
    counter++
  }
  if (pickedAddresses.length === options.numAddresses) {
    callback(true, { pickedAddresses })
  } else {
    Logger.writeLog('RND_006', 'picked addresses did not equal the number requested', {
      pickedAddresses: pickedAddresses.length,
      numAddresses: options.numAddresses,
      counter,
    })
    callback(false)
    return
  }
}

module.exports = RandomizeTransactions
