'use strict'

const Logger = require('./Logger.js')
const privateSettings = require('../settings/private.settings.json')
const SendRawTransaction = require('../lib/SendRawTransaction.js')

const ReturnToSender = {
  runtime: {},
}

ReturnToSender.send = (options, callback) => {
  if (!options.transaction || !options.client) {
    Logger.writeLog('RTS_001', 'invalid params', { options })
    callback(false)
    return
  }
  ReturnToSender.runtime = {}
  options.client.getRawTransaction(options.transaction.txid).then((incomingRaw) => {
    ReturnToSender.decodeOriginRaw({
      transaction: options.transaction,
      client: options.client,
      incomingRaw,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_002', 'unable to get raw transaction', {
      transaction: options.transaction,
      error: err,
    })
    callback(false)
  })
}

ReturnToSender.decodeOriginRaw = (options, callback) => {
  options.client.decodeRawTransaction(options.incomingRaw).then((incomingTrans) => {
    ReturnToSender.getOriginRaw({
      transaction: options.transaction,
      client: options.client,
      incomingTrans,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_003', 'unable to decode raw transaction', {
      transaction: options.transaction,
      incomingRaw: options.incomingRaw,
      error: err,
    })
    callback(false)
  })
}

ReturnToSender.getOriginRaw = (options, callback) => {
  options.client.getRawTransaction(options.incomingTrans.vin[0].txid).then((inputRaw) => {
    ReturnToSender.decodeOriginInputRaw({
      transaction: options.transaction,
      client: options.client,
      incomingTrans: options.incomingTrans,
      inputRaw,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_004', 'unable to get raw incoming transaction', {
      transaction: options.transaction,
      incomingTrans: options.incomingTrans,
      error: err,
    })
    callback(false)
  })
}

ReturnToSender.decodeOriginInputRaw = (options, callback) => {
  options.client.decodeRawTransaction(options.inputRaw).then((inputTrans) => {
    const origin = inputTrans.vout[options.incomingTrans.vin[0].vout].scriptPubKey.addresses[0]
    ReturnToSender.buildTransaction({
      transaction: options.transaction,
      client: options.client,
      origin,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_005', 'unable to decode raw incoming transaction', {
      transaction: options.transaction,
      inputRaw: options.inputRaw,
      error: err,
    })
    callback(false)
  })
}

ReturnToSender.buildTransaction = (options, callback) => {
  const outgoingTransactions = {}
  outgoingTransactions[options.origin] = options.transaction.amount - privateSettings.txFee

  const spentTransactions = [{
    txid: options.transaction.txid,
    vout: options.transaction.vout,
  }]
  SendRawTransaction.createRaw({
    outgoingTransactions,
    spentTransactions,
    client: options.client,
  }, callback)
}

module.exports = ReturnToSender
